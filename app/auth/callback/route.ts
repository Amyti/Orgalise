import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { AFTER_LOGIN_PATH, LOGIN_PATH } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'

/**
 * Retour des liens envoyés par e-mail (lien magique, confirmation
 * d'inscription) et des redirections OAuth.
 *
 * Deux formats selon la configuration du projet Supabase :
 *   - `?code=…`                   → échange PKCE
 *   - `?token_hash=…&type=magiclink` → vérification d'OTP
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // `next` reste interne : un chemin absolu externe serait une redirection ouverte.
  const nextParam = searchParams.get('next')
  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : AFTER_LOGIN_PATH

  // Le fournisseur OAuth a refusé ou l'utilisateur a annulé.
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${origin}${LOGIN_PATH}?erreur=apple`)
  }

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}${LOGIN_PATH}?erreur=lien`)
}
