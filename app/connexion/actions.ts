'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AFTER_LOGIN_PATH } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'
import type { AuthState } from './state'

const MIN_PASSWORD = 8

// Volontairement permissif : la vraie validation, c'est l'e-mail qui part.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Origine publique de l'app, pour les liens de retour (lien magique,
 * OAuth). En prod Vercel, `host` est déjà le bon domaine.
 */
async function siteOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Traduit les messages Supabase, qui sont en anglais et techniques. */
function frenchError(message: string, code?: string): string {
  const m = message.toLowerCase()

  if (code === 'invalid_credentials' || m.includes('invalid login credentials'))
    return 'E-mail ou mot de passe incorrect.'
  if (code === 'email_not_confirmed' || m.includes('email not confirmed'))
    return "Cet e-mail n'est pas encore confirmé. Regarde le lien qu'on t'a envoyé."
  if (code === 'user_already_exists' || m.includes('already registered'))
    return 'Un compte existe déjà avec cet e-mail. Connecte-toi.'
  if (code === 'weak_password' || m.includes('password should be'))
    return `Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.`
  if (code === 'over_email_send_rate_limit' || m.includes('rate limit') || m.includes('too many'))
    return 'Trop de tentatives. Réessaie dans quelques minutes.'
  if (m.includes('unsupported provider') || m.includes('provider is not enabled'))
    return "La connexion Apple n'est pas activée côté Supabase."
  if (m.includes('fetch failed') || m.includes('network'))
    return 'Connexion au serveur impossible. Vérifie ton réseau.'

  return "Ça n'a pas marché. Réessaie."
}

function readEmail(formData: FormData) {
  return String(formData.get('email') ?? '').trim().toLowerCase()
}

/**
 * Action unique du formulaire de connexion. Le bouton cliqué porte
 * `name="intent"`, ce qui évite de dupliquer l'état entre quatre actions.
 */
export async function authenticate(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const intent = String(formData.get('intent') ?? 'password')
  const email = readEmail(formData)
  const password = String(formData.get('password') ?? '')

  if (intent === 'apple') return signInWithApple()

  if (!email) {
    return { status: 'error', message: 'Entre ton adresse e-mail.', field: 'email', email }
  }
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: "Cette adresse e-mail n'a pas l'air valide.", field: 'email', email }
  }

  if (intent === 'magic') return sendMagicLink(email)
  if (intent === 'signup') return signUp(email, password)
  return signInWithPassword(email, password)
}

async function signInWithPassword(email: string, password: string): Promise<AuthState> {
  if (!password) {
    return { status: 'error', message: 'Entre ton mot de passe.', field: 'password', email }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { status: 'error', message: frenchError(error.message, error.code), field: 'password', email }
  }

  redirect(AFTER_LOGIN_PATH)
}

async function signUp(email: string, password: string): Promise<AuthState> {
  if (password.length < MIN_PASSWORD) {
    return {
      status: 'error',
      message: `Choisis un mot de passe d'au moins ${MIN_PASSWORD} caractères.`,
      field: 'password',
      email,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  })

  if (error) {
    return { status: 'error', message: frenchError(error.message, error.code), field: 'password', email }
  }

  // Compte déjà pris : Supabase renvoie un utilisateur factice sans
  // identité plutôt qu'une erreur, pour ne pas révéler l'existence du compte.
  if (data.user && data.user.identities?.length === 0) {
    return {
      status: 'error',
      message: 'Un compte existe déjà avec cet e-mail. Connecte-toi.',
      field: 'email',
      email,
    }
  }

  // Confirmation d'e-mail désactivée dans Supabase : la session est là.
  if (data.session) redirect(AFTER_LOGIN_PATH)

  return {
    status: 'sent',
    message: `Compte créé. Confirme ton adresse depuis l'e-mail envoyé à ${email}.`,
    email,
  }
}

async function sendMagicLink(email: string): Promise<AuthState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
      // Pas de création de compte silencieuse depuis l'écran de connexion.
      shouldCreateUser: false,
    },
  })

  if (error) {
    return { status: 'error', message: frenchError(error.message, error.code), field: 'email', email }
  }

  return {
    status: 'sent',
    message: `Lien envoyé à ${email}. Ouvre-le sur ce téléphone.`,
    email,
  }
}

async function signInWithApple(): Promise<AuthState> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  })

  if (error || !data.url) {
    return { status: 'error', message: frenchError(error?.message ?? '') }
  }

  redirect(data.url)
}
