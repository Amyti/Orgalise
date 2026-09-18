import ICAL from 'ical.js'

import { TZ, fromWall, wall } from './dates'
import type { Interval } from './intervals'

/**
 * Dépliage des événements récurrents.
 *
 * CLAUDE.md, décision 3 : la récurrence est stockée en RRULE + `exdates`,
 * jamais dépliée en lignes. C'est donc ici qu'on la déplie, à la volée,
 * pour la seule fenêtre affichée.
 *
 * Le dépliage se fait en **heure murale** : « tous les mardis à 20 h »
 * doit rester à 20 h après le changement d'heure, pas glisser à 19 h.
 */

export type RecurringEvent = {
  starts_at: string
  ends_at: string
  rrule: string | null
  exdates: string[] | null
  tz?: string | null
}

export type Occurrence<T> = {
  event: T
  start: Date
  end: Date
}

/** Garde-fou : une RRULE sans UNTIL ni COUNT itérerait sans fin. */
const MAX_OCCURRENCES = 750

export function expand<T extends RecurringEvent>(
  events: T[],
  windowStart: Date,
  windowEnd: Date,
): Occurrence<T>[] {
  const out: Occurrence<T>[] = []

  for (const event of events) {
    const start = new Date(event.starts_at)
    const end = new Date(event.ends_at)
    const lengthMs = end.getTime() - start.getTime()

    if (!event.rrule) {
      if (end > windowStart && start < windowEnd) out.push({ event, start, end })
      continue
    }

    const excluded = new Set(
      (event.exdates ?? []).map((d) => minuteKey(new Date(d))),
    )

    for (const occurrenceStart of iterate(event.rrule, start, windowStart, windowEnd, lengthMs)) {
      if (excluded.has(minuteKey(occurrenceStart))) continue
      const occurrenceEnd = new Date(occurrenceStart.getTime() + lengthMs)
      if (occurrenceEnd > windowStart && occurrenceStart < windowEnd) {
        out.push({ event, start: occurrenceStart, end: occurrenceEnd })
      }
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

function* iterate(
  rrule: string,
  seriesStart: Date,
  windowStart: Date,
  windowEnd: Date,
  lengthMs: number,
): Generator<Date> {
  let recur: ICAL.Recur
  try {
    recur = ICAL.Recur.fromString(rrule.replace(/^RRULE:/i, ''))
  } catch {
    // RRULE illisible : on retombe sur l'occurrence d'origine plutôt que
    // de faire disparaître l'événement.
    yield seriesStart
    return
  }

  // Ancre flottante : la règle s'applique à l'heure murale, pas à l'instant.
  const w = wall(seriesStart)
  // `localTimezone` est le fuseau « flottant » d'ical.js : l'itérateur
  // conserve les composantes murales, c'est `fromWall` qui les réancre.
  const anchor = new ICAL.Time(
    {
      year: w.year,
      month: w.month,
      day: w.day,
      hour: w.hour,
      minute: w.minute,
      second: 0,
      isDate: false,
    },
    ICAL.Timezone.localTimezone,
  )

  const iterator = recur.iterator(anchor)
  let next: ICAL.Time | null
  let count = 0

  while ((next = iterator.next()) && count < MAX_OCCURRENCES) {
    count++
    const at = fromWall(next.year, next.month, next.day, next.hour, next.minute)
    // L'itérateur avance dans le temps : au-delà de la fenêtre, on arrête.
    if (at.getTime() - lengthMs > windowEnd.getTime()) return
    if (at.getTime() + lengthMs < windowStart.getTime()) continue
    yield at
  }
}

function minuteKey(date: Date): string {
  return String(Math.floor(date.getTime() / 60_000))
}

/** Occurrences converties en simples plages, pour le calcul des creux. */
export function toIntervals<T extends RecurringEvent>(
  occurrences: Occurrence<T>[],
): Interval[] {
  return occurrences.map((o) => ({ start: o.start, end: o.end }))
}

export { TZ }
