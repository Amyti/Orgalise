'use client'

import { useActionState, useState } from 'react'

import { APP_NAME } from '@/lib/config'
import { authenticate } from './actions'
import { initialAuthState, type AuthState } from './state'
import styles from './connexion.module.css'

type Mode = 'signin' | 'signup'
type Intent = 'password' | 'signup' | 'magic' | 'apple'

export function LoginForm({
  configured,
  local,
  initialError,
}: {
  configured: boolean
  /** Vrai en développement local. */
  local: boolean
  /** Message d'échec transmis par /auth/callback (lien expiré, etc.). */
  initialError?: string
}) {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    authenticate,
    initialAuthState,
  )

  const [mode, setMode] = useState<Mode>('signin')
  // Quatre boutons partagent une seule action : on mémorise celui qui a
  // été cliqué pour n'afficher l'état d'attente que sur celui-là.
  const [pendingIntent, setPendingIntent] = useState<Intent | null>(null)

  // Saisie contrôlée : React 19 réinitialise un formulaire non contrôlé
  // après une action, et on perdrait l'e-mail à chaque erreur.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const busy = (intent: Intent) => isPending && pendingIntent === intent
  const disabled = isPending || !configured
  const isSignup = mode === 'signup'

  const invalid = state.status === 'error' ? state.field : undefined

  return (
    <div className={styles.screen}>
      <div className={styles.brand}>
        <div className={styles.dots} aria-hidden="true">
          <div className={`${styles.dot} ${styles.dotA}`} />
          <div className={`${styles.dot} ${styles.dotB}`} />
        </div>
        <div className={styles.appName}>{APP_NAME}</div>
      </div>

      <div className={styles.intro}>
        <h1 className={styles.title}>
          Votre semaine,
          <br />à deux.
        </h1>
        <p className={styles.subtitle}>
          Un agenda commun, vos dispos côte à côte, et les dépenses qui vont
          avec.
        </p>
      </div>

      <form action={formAction} noValidate>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Adresse e-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="salut@exemple.fr"
              className={`${styles.input} ${invalid === 'email' ? styles.inputInvalid : ''}`}
              aria-invalid={invalid === 'email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={disabled}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="mdp">
              {isSignup ? 'Choisir un mot de passe' : 'Mot de passe'}
            </label>
            <input
              id="mdp"
              name="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              className={`${styles.input} ${invalid === 'password' ? styles.inputInvalid : ''}`}
              aria-invalid={invalid === 'password'}
              aria-describedby={isSignup ? 'mdp-hint' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={disabled}
            />
            {isSignup && (
              <p id="mdp-hint" className={styles.hint}>
                8 caractères minimum.
              </p>
            )}
          </div>
        </div>

        <Message
          configured={configured}
          local={local}
          state={state}
          initialError={initialError}
        />

        <div className={styles.primaryWrap}>
          <button
            type="submit"
            name="intent"
            value={isSignup ? 'signup' : 'password'}
            className={styles.primary}
            onClick={() => setPendingIntent(isSignup ? 'signup' : 'password')}
            disabled={disabled}
          >
            {isSignup
              ? busy('signup')
                ? 'Création…'
                : 'Créer mon compte'
              : busy('password')
                ? 'Connexion…'
                : 'Se connecter'}
          </button>
        </div>

        <div className={styles.divider} aria-hidden="true">
          <div className={styles.line} />
          <div className={styles.or}>ou</div>
          <div className={styles.line} />
        </div>

        <div className={styles.alternatives}>
          <button
            type="submit"
            name="intent"
            value="magic"
            className={styles.secondary}
            onClick={() => setPendingIntent('magic')}
            disabled={disabled}
          >
            {busy('magic') ? 'Envoi…' : 'Recevoir un lien par e-mail'}
          </button>
          <button
            type="submit"
            name="intent"
            value="apple"
            className={styles.secondary}
            onClick={() => setPendingIntent('apple')}
            disabled={disabled}
          >
            {busy('apple') ? 'Ouverture…' : 'Continuer avec Apple'}
          </button>
        </div>
      </form>

      <div className={styles.spacer} />

      <div className={styles.footer}>
        {isSignup ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
        <button
          type="button"
          className={styles.footerAction}
          onClick={() => setMode(isSignup ? 'signin' : 'signup')}
        >
          {isSignup ? 'Se connecter' : 'En créer un'}
        </button>
      </div>
    </div>
  )
}

function Message({
  configured,
  local,
  state,
  initialError,
}: {
  configured: boolean
  /** Vrai en développement : le geste de configuration diffère. */
  local: boolean
  state: AuthState
  initialError?: string
}) {
  if (!configured) {
    // Le geste à faire n'est pas le même selon l'endroit : éditer un
    // fichier en local, déclarer des variables chez l'hébergeur en ligne.
    // Un message qui parle de `.env.local` en production envoie dans le mur.
    return (
      <div className={`${styles.message} ${styles.messageSetup}`}>
        {local ? (
          <>
            Supabase n'est pas configuré. Renseigne{' '}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> et{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans{' '}
            <code>.env.local</code>, puis relance <code>npm run dev</code>.
          </>
        ) : (
          <>
            Supabase n'est pas configuré. Ajoute{' '}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> et{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> aux variables
            d'environnement de l'hébergement, puis redéploie.
          </>
        )}
      </div>
    )
  }

  // Tant que rien n'a été soumis, on affiche l'échec venu du lien e-mail.
  const message = state.status === 'idle' ? initialError : state.message
  if (!message) return null

  const isError = state.status !== 'sent'

  return (
    <div
      className={`${styles.message} ${isError ? styles.messageError : styles.messageSent}`}
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
    >
      {message}
    </div>
  )
}
