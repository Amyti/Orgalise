import type { Metadata } from 'next'

import { EspaceScreen } from '@/components/espace/EspaceScreen'
import styles from '@/components/espace/espace.module.css'
import { NavSpacer } from '@/components/Fab'
import { currentSpace, requireProfile } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { CalendarFeed } from '@/lib/types'

export const metadata: Metadata = { title: 'Nous' }

/**
 * « Nous » avec l'agenda, « Réglages » sans.
 *
 * L'écran n'exige pas d'espace : quelqu'un qui n'utilise que le budget
 * doit pouvoir changer son prénom, ses outils ou le thème.
 */
export default async function NousPage() {
  const profile = await requireProfile()
  const space = profile.modules.agenda ? await currentSpace() : null

  let feeds: CalendarFeed[] = []
  if (space) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('calendar_feeds')
      .select('id, user_id, label, url, last_synced_at')
      .eq('group_id', space.group.id)
    feeds = (data ?? []) as CalendarFeed[]
  }

  return (
    <div className={`screen ${styles.screen}`}>
      <EspaceScreen
        space={space}
        feeds={feeds}
        mode="app"
        displayName={profile.display_name}
        modules={profile.modules}
      />
      <NavSpacer />
    </div>
  )
}
