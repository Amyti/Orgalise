import { redirect } from 'next/navigation'

import { AFTER_LOGIN_PATH, LOGIN_PATH } from '@/lib/config'
import { hasSupabaseEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

// Aiguillage pur : jamais de version figée au build.
export const dynamic = 'force-dynamic'

export default async function Home() {
  if (!hasSupabaseEnv()) redirect(LOGIN_PATH)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  redirect(user ? AFTER_LOGIN_PATH : LOGIN_PATH)
}
