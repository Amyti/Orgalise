import { NextResponse, type NextRequest } from 'next/server'

import { LOGIN_PATH, AFTER_LOGIN_PATH } from '@/lib/config'
import { hasSupabaseEnv } from '@/lib/supabase/env'
import { USER_HEADER, updateSession } from '@/lib/supabase/session'
import { isFresh, readTokenClaims } from '@/lib/supabase/token'

/** Routes accessibles sans session. */
const PUBLIC_PATHS = [LOGIN_PATH, '/auth', '/api/dev']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/** Aiguillage commun aux deux chemins, rapide et complet. */
function route(request: NextRequest, userId: string | null, headers: Headers) {
  const { pathname } = request.nextUrl

  if (!userId && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (userId && pathname === LOGIN_PATH) {
    const url = request.nextUrl.clone()
    url.pathname = AFTER_LOGIN_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  return null
}

/**
 * `proxy` = l'ancien `middleware`, renommé dans Next 16.
 *
 * Deux chemins. Le rapide lit le jeton dans le cookie et décide sur place
 * — aucun appel réseau. Le complet passe par Supabase pour revalider et
 * rafraîchir ; il ne sert que quand le jeton approche de son expiration,
 * ou quand le cookie est illisible.
 *
 * Ce choix ne relâche rien : le proxy ne fait que de l'aiguillage. Toute
 * lecture ou écriture de données est vérifiée par Supabase et filtrée par
 * RLS, y compris avec un jeton forgé qui passerait la redirection.
 */
export default async function proxy(request: NextRequest) {
  // Toute valeur entrante de l'en-tête d'identité est effacée avant qu'une
  // page puisse la lire : elle ne peut donc pas être forgée par le client.
  const headers = new Headers(request.headers)
  headers.delete(USER_HEADER)

  if (!hasSupabaseEnv()) {
    // Supabase pas encore configuré : l'écran de connexion l'explique.
    return NextResponse.next({ request: { headers } })
  }

  const claims = readTokenClaims(request.cookies.getAll())

  if (claims && isFresh(claims)) {
    headers.set(USER_HEADER, claims.sub)
    return route(request, claims.sub, headers) ?? NextResponse.next({ request: { headers } })
  }

  // Jeton absent, expirant ou illisible : vérification complète.
  const { response, user } = await updateSession(request)
  return route(request, user?.id ?? null, new Headers(request.headers)) ?? response
}

export const config = {
  matcher: [
    /*
     * Tout sauf les fichiers statiques et les images — inutile de
     * rafraîchir la session pour un PNG.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
