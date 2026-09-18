import { addDays, startOfDay } from './dates'
import {
  atLeast,
  clip,
  complement,
  merge,
  minutes,
  type Interval,
} from './intervals'
import { expand, toIntervals, type Occurrence } from './recurrence'
import { createClient } from './supabase/server'
import type { EventRow, Space } from './types'

/**
 * Le modèle de données de l'agenda.
 *
 * Toutes les vues (semaine, jour, mois, accueil) lisent la même chose :
 * deux séries de plages occupées — une par personne —, les événements
 * communs, et le complément des deux, qui donne les créneaux libres.
 * C'est cette grammaire que CLAUDE.md décrit comme le cœur du produit.
 */

export type Band = { from: number; to: number }

/** Plage horaire MINIMALE de la vue semaine et de l'accueil. */
export const WEEK_BAND: Band = { from: 7, to: 23 }
/** Plage horaire minimale de la vue jour, un peu plus resserrée. */
export const DAY_BAND: Band = { from: 8, to: 22 }

/** En dessous, un « creux » n'en est pas un. */
export const MIN_FREE_MINUTES = 30

export type Agenda = {
  windowStart: Date
  windowEnd: Date
  /** Occupé, personne connectée. */
  mine: Interval[]
  /** Occupé, l'autre. `[]` tant qu'il n'y a personne. */
  theirs: Interval[]
  /** Événements communs, récurrences dépliées. */
  events: Occurrence<EventRow>[]
  /** Libre pour les deux : ni occupé, ni pris par un événement commun. */
  free: Interval[]
}

export async function loadAgenda(
  space: Space,
  windowStart: Date,
  windowEnd: Date,
): Promise<Agenda> {
  const supabase = await createClient()

  const [{ data: rawEvents }, { data: blocks }] = await Promise.all([
    supabase
      .from('events')
      .select('id, group_id, title, notes, starts_at, ends_at, all_day, tz, rrule, exdates, created_by')
      .eq('group_id', space.group.id)
      .lt('starts_at', windowEnd.toISOString())
      .order('starts_at')
      .limit(2000),
    supabase
      .from('busy_blocks')
      .select('id, user_id, starts_at, ends_at')
      .eq('group_id', space.group.id)
      .lt('starts_at', windowEnd.toISOString())
      .gt('ends_at', windowStart.toISOString())
      .order('starts_at')
      .limit(5000),
  ])

  // Les événements récurrents sont gardés quelle que soit leur date de
  // départ : c'est le dépliage qui décide s'ils tombent dans la fenêtre.
  const candidates = ((rawEvents ?? []) as EventRow[]).filter(
    (e) => e.rrule !== null || new Date(e.ends_at) > windowStart,
  )

  const events = expand(candidates, windowStart, windowEnd)

  const mine: Interval[] = []
  const theirs: Interval[] = []
  for (const b of blocks ?? []) {
    const interval = { start: new Date(b.starts_at), end: new Date(b.ends_at) }
    if (b.user_id === space.me.id) mine.push(interval)
    else theirs.push(interval)
  }

  // Libre à deux = complément de tout ce qui occupe l'un OU l'autre,
  // événements communs compris.
  const busy = merge([...mine, ...theirs, ...toIntervals(events)])
  const free = complement(busy, windowStart, windowEnd)

  return {
    windowStart,
    windowEnd,
    mine: merge(mine),
    theirs: merge(theirs),
    events,
    free,
  }
}

export type DayView = {
  date: Date
  start: Date
  end: Date
  mine: Interval[]
  theirs: Interval[]
  events: Occurrence<EventRow>[]
  free: Interval[]
  /** Minutes réellement libres à deux sur la journée entière. */
  freeMinutes: number
}

/** Découpe un agenda en journées, chacune bornée à minuit. */
export function splitDays(agenda: Agenda, days: Date[]): DayView[] {
  return days.map((date) => {
    const start = startOfDay(date)
    const end = addDays(start, 1)

    const free = clip(agenda.free, start, end)

    return {
      date: start,
      start,
      end,
      mine: clip(agenda.mine, start, end),
      theirs: clip(agenda.theirs, start, end),
      events: agenda.events.filter((o) => o.end > start && o.start < end),
      free,
      freeMinutes: free.reduce((sum, f) => sum + minutes(f), 0),
    }
  })
}

/**
 * Les meilleurs creux de la fenêtre : les plus longs d'abord, un seul par
 * jour pour ne pas afficher trois fois le même samedi.
 */
export function bestSlots(
  days: DayView[],
  limit = 2,
  band: Band = WEEK_BAND,
): { day: DayView; slot: Interval }[] {
  const perDay = days.flatMap((day) => {
    const inBand = atLeast(
      clip(day.free, hourOf(day.start, band.from), hourOf(day.start, band.to)),
      MIN_FREE_MINUTES,
    )
    if (inBand.length === 0) return []
    const best = inBand.reduce((a, b) => (minutes(b) > minutes(a) ? b : a))
    return [{ day, slot: best }]
  })

  return perDay
    .sort((a, b) => minutes(b.slot) - minutes(a.slot))
    .slice(0, limit)
    .sort((a, b) => a.slot.start.getTime() - b.slot.start.getTime())
}

/**
 * Étend une bande pour qu'elle contienne tout ce qui est réellement
 * occupé sur la fenêtre affichée.
 *
 * Sans ça, une garde à 5 h du matin ne serait pas seulement mal placée :
 * elle serait **invisible**, découpée hors de la bande. La bande ne fait
 * que s'agrandir — on garde le minimum des maquettes pour qu'une journée
 * vide ressemble encore à une journée, et que « libre en soirée » veuille
 * dire la même chose d'une semaine à l'autre.
 *
 * Une seule bande pour toute la vue, jamais une par jour : sept lignes à
 * des échelles différentes ne seraient plus comparables entre elles, et
 * c'est cette comparaison qui porte la vue semaine.
 */
export function computeBand(days: DayView[], base: Band = WEEK_BAND): Band {
  let from = base.from
  let to = base.to

  for (const day of days) {
    const spans: Interval[] = [
      ...day.mine,
      ...day.theirs,
      // Une journée entière irait de 0 h à 24 h et écraserait l'échelle
      // pour tous les autres : elle ne borne pas la bande.
      ...day.events
        .filter((o) => !o.event.all_day)
        .map((o) => ({ start: o.start, end: o.end })),
    ]

    for (const span of spans) {
      from = Math.min(from, Math.floor(hoursInto(span.start, day.start)))
      to = Math.max(to, Math.ceil(hoursInto(span.end, day.start)))
    }
  }

  return { from: Math.max(0, from), to: Math.min(24, to) }
}

/** Heure décimale d'un instant dans sa journée. 9 h 30 → 9.5. */
function hoursInto(at: Date, dayStart: Date): number {
  return (at.getTime() - dayStart.getTime()) / 3_600_000
}

/** Instant correspondant à `hour` heures après minuit ce jour-là. */
export function hourOf(dayStart: Date, hour: number): Date {
  return new Date(dayStart.getTime() + hour * 3_600_000)
}

/** Position d'une plage sur une bande horaire, en pourcentage. */
export function bandPosition(
  interval: Interval,
  dayStart: Date,
  band: Band,
): { left: number; width: number } | null {
  const span = band.to - band.from
  const from = (interval.start.getTime() - dayStart.getTime()) / 3_600_000
  const to = (interval.end.getTime() - dayStart.getTime()) / 3_600_000

  const left = Math.max(0, (from - band.from) / span) * 100
  const right = Math.min(1, (to - band.from) / span) * 100

  if (right <= left) return null
  return { left, width: right - left }
}

/** Le prochain événement commun à venir, récurrences comprises. */
export function nextEvent(
  agenda: Agenda,
  now: Date,
): Occurrence<EventRow> | null {
  return agenda.events.find((o) => o.end > now) ?? null
}

/** Taux d'occupation d'une journée, 0 → 1. Sert à la densité du mois. */
export function occupancy(intervals: Interval[], dayStart: Date, band: Band = WEEK_BAND): number {
  const from = hourOf(dayStart, band.from)
  const to = hourOf(dayStart, band.to)
  const total = (band.to - band.from) * 60
  const busy = clip(intervals, from, to).reduce((sum, i) => sum + minutes(i), 0)
  return Math.min(1, busy / total)
}

/**
 * Graduations d'une bande : `count` libellés, du début à la fin.
 * Sert aux repères sous la timeline de l'accueil.
 */
export function bandTicks(band: Band, count = 4): number[] {
  if (count < 2) return [band.from]
  const step = (band.to - band.from) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(band.from + i * step))
}

/** Heures pleines d'une bande, tous les `step` heures. */
export function bandHours(band: Band, step = 2): number[] {
  const hours: number[] = []
  for (let h = Math.ceil(band.from); h <= band.to; h += step) hours.push(h)
  return hours
}
