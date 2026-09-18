import type { Metadata } from 'next'

import { EspaceScreen } from '@/components/espace/EspaceScreen'
import styles from '@/components/espace/espace.module.css'
import { currentProfile, requireSpace } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { CalendarFeed } from '@/lib/types'

export const metadata: Metadata = { title: "Votre espace" }

/** Version « parcours d'entrée » : pas de barre de navigation, une sortie. */
export default async function EspacePage() {
  const space = await requireSpace()
  const profile = await currentProfile()
  const supabase = await createClient()

  const { data: feeds } = await supabase
    .from('calendar_feeds')
    .select('id, user_id, label, url, last_synced_at')
    .eq('group_id', space.group.id)

  return (
    <div className={`screen ${styles.screen}`}>
      <EspaceScreen
        space={space}
        feeds={(feeds ?? []) as CalendarFeed[]}
        mode="onboarding"
        displayName={profile?.display_name ?? space.me.display_name}
        modules={profile?.modules ?? { agenda: true, budget: true, chosen: true }}
      />
    </div>
  )
}
