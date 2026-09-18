import type { Metadata } from 'next'

import { EspaceScreen } from '@/components/espace/EspaceScreen'
import styles from '@/components/espace/espace.module.css'
import { requireSpace } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { CalendarFeed } from '@/lib/types'

export const metadata: Metadata = { title: "Votre espace" }

/** Version « parcours d'entrée » : pas de barre de navigation, une sortie. */
export default async function EspacePage() {
  const space = await requireSpace()
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
      />
    </div>
  )
}
