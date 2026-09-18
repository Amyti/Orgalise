import { createBrowserClient } from '@supabase/ssr'

import { supabaseEnv } from './env'

/** Client Supabase côté navigateur (composants clients). */
export function createClient() {
  const { url, anonKey } = supabaseEnv()
  return createBrowserClient(url, anonKey)
}
