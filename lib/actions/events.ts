'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { TZ, addDays, parseInputValue, startOfDay } from '@/lib/dates'
import { currentSpace } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import { VALID_RRULES, type EventState } from './state'

function read(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim().slice(0, 120)
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500)
  const allDay = formData.get('all_day') === 'on'
  const rrule = String(formData.get('rrule') ?? '')

  const startsAt = parseInputValue(String(formData.get('starts_at') ?? ''))
  const endsAt = parseInputValue(String(formData.get('ends_at') ?? ''))

  return { title, notes, allDay, rrule, startsAt, endsAt }
}

function validate(input: ReturnType<typeof read>): string | null {
  if (!input.title) return "Donne un titre à l'événement."
  if (!input.startsAt) return "La date de début n'est pas valide."
  if (!input.endsAt) return "La date de fin n'est pas valide."
  if (!VALID_RRULES.has(input.rrule))
    return 'Cette récurrence ne fait pas partie des choix.'
  // Une journée entière se saisit en dates seules : la comparaison des
  // bornes se fait après normalisation, pas ici.
  if (!input.allDay && input.endsAt <= input.startsAt)
    return 'La fin doit venir après le début.'
  if (input.allDay && input.endsAt < input.startsAt)
    return 'Le dernier jour vient avant le premier.'
  return null
}

/** Une journée entière couvre de minuit au minuit suivant, bornes comprises. */
function normaliseRange(input: ReturnType<typeof read>) {
  if (!input.allDay) return { start: input.startsAt!, end: input.endsAt! }
  return {
    start: startOfDay(input.startsAt!),
    end: addDays(startOfDay(input.endsAt!), 1),
  }
}

export async function saveEvent(
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  const id = String(formData.get('id') ?? '')
  const input = read(formData)

  const problem = validate(input)
  if (problem) return { status: 'error', message: problem }

  const space = await currentSpace()
  if (!space) return { status: 'error', message: 'Espace introuvable.' }

  const supabase = await createClient()
  const range = normaliseRange(input)

  const row = {
    group_id: space.group.id,
    title: input.title,
    notes: input.notes || null,
    starts_at: range.start.toISOString(),
    ends_at: range.end.toISOString(),
    all_day: input.allDay,
    // Fuseau d'origine : indispensable pour réafficher correctement un
    // événement créé ailleurs (CLAUDE.md, décision 4).
    tz: TZ,
    rrule: input.rrule || null,
  }

  const { error } = id
    ? await supabase.from('events').update(row).eq('id', id)
    : await supabase.from('events').insert({ ...row, created_by: space.me.id })

  if (error) {
    return { status: 'error', message: "L'événement n'a pas pu être enregistré." }
  }

  revalidatePath('/', 'layout')
  redirect('/agenda')
}

/**
 * Suppression. Pour une série, deux gestes différents :
 * retirer une seule date (`exdates`) ou supprimer la règle entière.
 */
export async function deleteEvent(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const scope = String(formData.get('scope') ?? 'all')
  const occurrence = String(formData.get('occurrence') ?? '')

  if (!id) return

  const supabase = await createClient()

  if (scope === 'occurrence' && occurrence) {
    const { data: event } = await supabase
      .from('events')
      .select('exdates')
      .eq('id', id)
      .maybeSingle()

    const exdates = [...(event?.exdates ?? []), occurrence]
    await supabase.from('events').update({ exdates }).eq('id', id)
  } else {
    await supabase.from('events').delete().eq('id', id)
  }

  revalidatePath('/', 'layout')
  redirect('/agenda')
}
