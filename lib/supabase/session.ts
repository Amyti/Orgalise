import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { supabaseEnv } from './env'

/**
 * Rafraîchit le token de session et le réécrit dans les cookies de la
 * réponse. Sans ça, les Server Components voient une session expirée.
 * Appelé depuis `proxy.ts`, à chaque requête.
 *
 * Renvoie aussi l'utilisateur pour éviter un second aller-retour.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const { url, anonKey } = supabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser() et pas getSession() : seul getUser() revalide le JWT
  // auprès de Supabase. getSession() fait confiance au cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
