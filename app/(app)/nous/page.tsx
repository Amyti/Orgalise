import type { Metadata } from 'next'

import { EspaceScreen } from '@/components/espace/EspaceScreen'
import styles from '@/components/espace/espace.module.css'
import { NavSpacer } from '@/components/Fab'
import { requireSpace } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { CalendarFeed } from '@/lib/types'

export const metadata: Metadata = { title: 'Nous' }

export default async function NousPage() {
  const space = await requireSpace()
  const supabase = await createClient()

  const { data: feeds } = await supabase
    .from('calendar_feeds')
    .select('id, user_id, label, url, last_synced_at')
    .eq('group_id', space.group.id)

  return (
    <div className={`screen ${styles.screen}`}>
      <EspaceScreen space={space} feeds={(feeds ?? []) as CalendarFeed[]} mode="app" />
      <NavSpacer />
    </div>
  )
}
