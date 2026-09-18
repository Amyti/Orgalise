import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { supabaseEnv } from './env'

/**
 * Client Supabase côté serveur (Server Components, Server Actions,
 * Route Handlers). À recréer à chaque requête : il porte les cookies
 * de session de l'utilisateur courant.
 */
export async function createClient() {
  // `cookies()` d'abord : c'est lui qui bascule la route en rendu
  // dynamique. Lire l'env avant ferait échouer le build au prérendu.
  const cookieStore = await cookies()
  const { url, anonKey } = supabaseEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Appelé depuis un Server Component : l'écriture de cookie est
          // interdite. Sans gravité, le middleware rafraîchit la session.
        }
      },
    },
  })
}
