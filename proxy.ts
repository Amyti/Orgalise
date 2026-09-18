import { NextResponse, type NextRequest } from 'next/server'

import { LOGIN_PATH, AFTER_LOGIN_PATH } from '@/lib/config'
import { hasSupabaseEnv } from '@/lib/supabase/env'
import { updateSession } from '@/lib/supabase/session'

/**
 * Routes accessibles sans session.
 *
 * `/api/dev` sert le faux calendrier de test : la synchro le récupère par
 * un `fetch` serveur, sans cookie, donc il doit rester ouvert. La route
 * elle-même renvoie 404 en production.
 */
const PUBLIC_PATHS = [LOGIN_PATH, '/auth', '/api/dev']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/** `proxy` = l'ancien `middleware`, renommé dans Next 16. */
export default async function proxy(request: NextRequest) {
  // Supabase pas encore configuré : on laisse passer, l'écran de
  // connexion affiche lui-même quoi renseigner.
  if (!hasSupabaseEnv()) return NextResponse.next()

  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (user && pathname === LOGIN_PATH) {
    const url = request.nextUrl.clone()
    url.pathname = AFTER_LOGIN_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
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
