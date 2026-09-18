import { redirect } from 'next/navigation'

import { AFTER_LOGIN_PATH, LOGIN_PATH } from '@/lib/config'
import { landingPath } from '@/lib/modules'
import { currentProfile } from '@/lib/space'
import { hasSupabaseEnv } from '@/lib/supabase/env'

// Aiguillage pur : jamais de version figée au build.
export const dynamic = 'force-dynamic'

export default async function Home() {
  if (!hasSupabaseEnv()) redirect(LOGIN_PATH)

  const profile = await currentProfile()
  if (!profile) redirect(LOGIN_PATH)
  redirect(profile.modules.chosen ? landingPath(profile.modules) : AFTER_LOGIN_PATH)
}
