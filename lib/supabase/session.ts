import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { supabaseEnv } from './env'

/**
 * En-tête par lequel le proxy transmet aux pages l'identité qu'il vient
 * de vérifier.
 *
 * Sans lui, chaque écran refaisait un `getUser()` — un aller-retour
 * réseau vers Supabase pour revalider le même jeton, dans la même
 * requête. C'était une vague entière sur les quatre.
 *
 * Il est **toujours** réécrit par le proxy, y compris quand il est vide :
 * un client qui l'enverrait lui-même verrait sa valeur écrasée avant
 * d'atteindre la moindre page. Et même s'il passait, la sécurité réelle
 * ne repose pas dessus — chaque requête de données est vérifiée par
 * Supabase et filtrée par RLS.
 */
export const USER_HEADER = 'x-orgalise-user'

/**
 * Rafraîchit le token de session, réécrit les cookies de la réponse, et
 * annonce l'utilisateur vérifié aux pages.
 *
 * `getUser()` et pas `getSession()` : seul le premier revalide le JWT
 * auprès de Supabase. Le second fait confiance au cookie.
 */
export async function updateSession(request: NextRequest) {
  // Point de départ propre : toute valeur entrante de l'en-tête est
  // supprimée avant qu'une page puisse la lire.
  const headers = new Headers(request.headers)
  headers.delete(USER_HEADER)

  let response = NextResponse.next({ request: { headers } })

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
        response = NextResponse.next({ request: { headers } })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    headers.set(USER_HEADER, user.id)
    // La réponse a pu être reconstruite par `setAll` avant qu'on connaisse
    // l'utilisateur : on la rebâtit avec les en-têtes à jour.
    const cookies = response.cookies.getAll()
    response = NextResponse.next({ request: { headers } })
    for (const c of cookies) response.cookies.set(c)
  }

  return { response, user }
}
