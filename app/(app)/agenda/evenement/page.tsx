import type { Metadata } from 'next'
import Link from 'next/link'

import { CloseIcon } from '@/components/Icons'
import { deleteEvent } from '@/lib/actions/events'
import { addDays, hoursFrom, parseIsoDay, startOfDay } from '@/lib/dates'
import { requireSpace } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { EventRow } from '@/lib/types'
import { EventForm, type EventDraft } from './EventForm'
import styles from './evenement.module.css'

export const metadata: Metadata = { title: 'Événement' }

export default async function EvenementPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; date?: string; occurrence?: string }>
}) {
  await requireSpace()
  const { id, date, occurrence } = await searchParams

  const existing = id ? await loadEvent(id) : null
  const draft = existing ? toDraft(existing) : blankDraft(parseIsoDay(date))

  return (
    <div className={`screen ${styles.screen}`}>
      <div className={styles.bar}>
        <Link href="/agenda" className="backLink" aria-label="Annuler">
          <CloseIcon size={19} color="var(--ink)" />
        </Link>
        <div className={styles.barTitle}>
          {existing ? "Modifier l'événement" : 'Nouvel événement'}
        </div>
        <div className={styles.barSpacer} />
      </div>

      <EventForm draft={draft} />

      {existing && (
        <div className={styles.foot}>
          {existing.rrule ? (
            <div className={styles.dangerRow}>
              <form action={deleteEvent}>
                <input type="hidden" name="id" value={existing.id} />
                <input type="hidden" name="scope" value="occurrence" />
                <input
                  type="hidden"
                  name="occurrence"
                  value={occurrence ?? existing.starts_at}
                />
                <button type="submit" className={styles.danger}>
                  Cette fois seulement
                </button>
              </form>
              <form action={deleteEvent}>
                <input type="hidden" name="id" value={existing.id} />
                <input type="hidden" name="scope" value="all" />
                <button type="submit" className={styles.danger}>
                  Toute la série
                </button>
              </form>
            </div>
          ) : (
            <form action={deleteEvent}>
              <input type="hidden" name="id" value={existing.id} />
              <input type="hidden" name="scope" value="all" />
              <button type="submit" className={styles.danger}>
                Supprimer l'événement
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

async function loadEvent(id: string): Promise<EventRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select(
      'id, group_id, title, notes, starts_at, ends_at, all_day, tz, rrule, exdates, created_by',
    )
    .eq('id', id)
    .maybeSingle()
  return (data as EventRow) ?? null
}

function toDraft(event: EventRow): EventDraft {
  // Une journée entière est stockée jusqu'au minuit suivant : on réaffiche
  // le dernier jour réellement occupé, pas le lendemain.
  const end = event.all_day
    ? addDays(new Date(event.ends_at), -1)
    : new Date(event.ends_at)

  return {
    id: event.id,
    title: event.title,
    notes: event.notes ?? '',
    start: event.starts_at,
    end: end.toISOString(),
    allDay: event.all_day,
    rrule: event.rrule ?? '',
  }
}

/** Par défaut : le jour visé, de 19 h à 20 h 30 — l'heure des choses à deux. */
function blankDraft(date: Date | null): EventDraft {
  const day = startOfDay(date ?? new Date())
  return {
    title: '',
    notes: '',
    start: hoursFrom(day, 19).toISOString(),
    end: hoursFrom(day, 20.5).toISOString(),
    allDay: false,
    rrule: '',
  }
}
