import type { Metadata } from 'next'

import { hasSupabaseEnv } from '@/lib/supabase/env'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Connexion',
}

/** Motifs d'échec renvoyés par /auth/callback. */
const ERREURS: Record<string, string> = {
  lien: "Ce lien a expiré ou a déjà servi. Demandes-en un nouveau.",
}

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>
}) {
  const { erreur } = await searchParams

  return (
    <LoginForm
      configured={hasSupabaseEnv()}
      local={process.env.NODE_ENV !== 'production'}
      initialError={erreur ? (ERREURS[erreur] ?? ERREURS.lien) : undefined}
    />
  )
}
