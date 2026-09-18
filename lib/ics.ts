import ICAL from 'ical.js'

import type { Interval } from './intervals'
import { merge } from './intervals'

/**
 * Import iCal, en lecture seule.
 *
 * CLAUDE.md, décision 5 : on ne garde **que** des plages occupées. Aucun
 * titre, aucune description, aucun lieu ne sort de cette fonction — c'est
 * volontaire, et c'est ce qui permet d'afficher l'agenda de l'autre sans
 * lui faire ouvrir sa vie privée.
 *
 * La partie délicate n'est pas le parsing mais la récurrence : `EXDATE`
 * et surtout `RECURRENCE-ID` (une occurrence déplacée) demandent de
 * rattacher les exceptions à leur série avant de déplier.
 */

const MAX_BYTES = 8 * 1024 * 1024
const MAX_OCCURRENCES_PER_EVENT = 400

export type IcsResult = {
  busy: Interval[]
  /** Nombre de VEVENT lus, pour le message de synchro. */
  events: number
}

export async function fetchIcs(url: string, signal?: AbortSignal): Promise<string> {
  const normalised = url.replace(/^webcal:\/\//i, 'https://')

  const response = await fetch(normalised, {
    signal,
    redirect: 'follow',
    headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Le calendrier a répondu ${response.status}.`)
  }

  const text = await response.text()
  if (text.length > MAX_BYTES) {
    throw new Error('Ce calendrier est trop volumineux.')
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error("Cette adresse ne renvoie pas un calendrier iCal.")
  }
  return text
}

/**
 * Extrait les plages occupées d'un flux iCal sur une fenêtre donnée.
 * Les plages qui se chevauchent sont fusionnées : deux réunions
 * superposées, c'est un seul bloc occupé.
 */
export function busyBlocks(ics: string, windowStart: Date, windowEnd: Date): IcsResult {
  const component = new ICAL.Component(ICAL.parse(ics))
  const vevents = component.getAllSubcomponents('vevent')

  const masters = new Map<string, ICAL.Event>()
  const exceptions: ICAL.Event[] = []

  for (const vevent of vevents) {
    let event: ICAL.Event
    try {
      event = new ICAL.Event(vevent)
    } catch {
      continue // VEVENT incomplet : on passe, un flux ne doit pas tout casser.
    }
    if (event.isRecurrenceException()) exceptions.push(event)
    else if (event.uid) masters.set(event.uid, event)
  }

  // Une occurrence déplacée doit remplacer celle de la série, pas s'y ajouter.
  for (const exception of exceptions) {
    const master = exception.uid ? masters.get(exception.uid) : undefined
    if (master) master.relateException(exception)
    else exceptions.splice(exceptions.indexOf(exception), 1)
  }

  const busy: Interval[] = []

  for (const event of masters.values()) {
    if (!countsAsBusy(event)) continue

    if (!event.isRecurring()) {
      push(busy, event.startDate, event.endDate, windowStart, windowEnd)
      continue
    }

    const iterator = event.iterator()
    let next: ICAL.Time | null
    let count = 0

    while ((next = iterator.next()) && count < MAX_OCCURRENCES_PER_EVENT) {
      count++
      let details
      try {
        details = event.getOccurrenceDetails(next)
      } catch {
        continue
      }
      const start = details.startDate.toJSDate()
      if (start.getTime() > windowEnd.getTime()) break
      push(busy, details.startDate, details.endDate, windowStart, windowEnd)
    }
  }

  // Les exceptions orphelines (série absente du flux) comptent quand même.
  for (const exception of exceptions) {
    if (!exception.uid || masters.has(exception.uid)) continue
    if (!countsAsBusy(exception)) continue
    push(busy, exception.startDate, exception.endDate, windowStart, windowEnd)
  }

  return { busy: merge(busy), events: vevents.length }
}

/**
 * Un événement n'occupe pas forcément : annulé, refusé, ou marqué
 * « disponible » (c'est le cas par défaut des journées entières chez
 * Google), il ne doit pas manger un créneau libre.
 */
function countsAsBusy(event: ICAL.Event): boolean {
  const vevent = event.component

  const status = vevent.getFirstPropertyValue('status')
  if (typeof status === 'string' && /cancelled/i.test(status)) return false

  const transp = vevent.getFirstPropertyValue('transp')
  if (typeof transp === 'string' && /transparent/i.test(transp)) return false

  return true
}

function push(
  out: Interval[],
  start: ICAL.Time | null,
  end: ICAL.Time | null,
  windowStart: Date,
  windowEnd: Date,
) {
  if (!start) return

  const s = start.toJSDate()
  // Pas de DTEND ni de DURATION : l'événement est ponctuel, on ignore.
  const e = end ? end.toJSDate() : null
  if (!e || e.getTime() <= s.getTime()) return

  if (e.getTime() <= windowStart.getTime() || s.getTime() >= windowEnd.getTime()) return

  out.push({
    start: new Date(Math.max(s.getTime(), windowStart.getTime())),
    end: new Date(Math.min(e.getTime(), windowEnd.getTime())),
  })
}
