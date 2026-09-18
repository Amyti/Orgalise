import { NextResponse, type NextRequest } from 'next/server'

import { addDays, fromWall, startOfWeek, wall } from '@/lib/dates'

/**
 * Faux calendrier iCal, pour tester l'import sans brancher un vrai compte.
 *
 * Les dates sont calculées sur la semaine en cours : un fichier figé
 * serait hors fenêtre dès la semaine suivante et n'afficherait rien.
 *
 * Deux profils pour voir les deux rubans se croiser :
 *   /api/dev/ics?qui=moi
 *   /api/dev/ics?qui=elle
 *
 * Réservé au développement — renvoie 404 en production.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Introuvable.', { status: 404 })
  }

  const qui = request.nextUrl.searchParams.get('qui') === 'elle' ? 'elle' : 'moi'
  const monday = startOfWeek(new Date())

  return new NextResponse(build(monday, qui), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

type Slot = {
  /** Décalage en jours depuis le lundi de cette semaine. */
  day: number
  from: number
  to: number
  title: string
  rrule?: string
  /** Occurrences retirées de la série, en jours depuis lundi. */
  exdates?: number[]
  status?: 'CANCELLED'
  transp?: 'TRANSPARENT'
  allDay?: boolean
}

/**
 * Deux semaines volontairement asymétriques : c'est le décalage entre les
 * deux emplois du temps qui fait apparaître les creux communs.
 */
function slots(qui: 'moi' | 'elle'): Slot[] {
  if (qui === 'elle') {
    return [
      // Semaine de cours + boulot, décalée d'une demi-heure.
      { day: 0, from: 8.5, to: 17, title: 'Cours' },
      { day: 1, from: 9, to: 17, title: 'Cours' },
      { day: 2, from: 10, to: 16, title: 'Bureau' },
      { day: 3, from: 8.5, to: 12, title: 'Cours' },
      { day: 3, from: 14, to: 18, title: 'Bureau' },
      { day: 4, from: 9, to: 16, title: 'Bureau' },
      // Une série hebdomadaire, avec une occurrence retirée : c'est le cas
      // que CLAUDE.md signale comme coûteux (EXDATE).
      {
        day: 1,
        from: 18.5,
        to: 20,
        title: 'Chorale',
        rrule: 'FREQ=WEEKLY;COUNT=8',
        exdates: [8],
      },
      // Garde de nuit : commence à 5 h, bien avant la bande par défaut.
      // C'est le cas qui rendait le ruban invisible.
      { day: 2, from: 5, to: 9, title: 'Garde' },
      { day: 4, from: 5.5, to: 8, title: 'Garde' },
      // Journée entière marquée disponible : ne doit PAS bloquer le samedi.
      { day: 5, from: 0, to: 24, title: 'Anniversaire de Claire', allDay: true, transp: 'TRANSPARENT' },
    ]
  }

  return [
    { day: 0, from: 9, to: 18, title: 'Travail' },
    { day: 1, from: 9, to: 13, title: 'Travail' },
    { day: 2, from: 9, to: 18, title: 'Travail' },
    { day: 3, from: 9, to: 13, title: 'Travail' },
    { day: 4, from: 9, to: 18, title: 'Travail' },
    { day: 5, from: 11, to: 13, title: 'Sport' },
    // Point quotidien récurrent du lundi au vendredi.
    { day: 0, from: 8.5, to: 9, title: 'Point équipe', rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=20' },
    // Annulé : ne doit pas occuper le créneau.
    { day: 6, from: 14, to: 18, title: 'Réunion annulée', status: 'CANCELLED' },
  ]
}

function build(monday: Date, qui: 'moi' | 'elle'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orgalise//Faux calendrier//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Démo ${qui}`,
  ]

  const stamp = utc(new Date())
  let n = 0

  for (const slot of slots(qui)) {
    n++
    const start = at(monday, slot.day, slot.from)
    const end = at(monday, slot.day, slot.to)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:demo-${qui}-${n}@orgalise.local`)
    lines.push(`DTSTAMP:${stamp}`)

    if (slot.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${date(start)}`)
      lines.push(`DTEND;VALUE=DATE:${date(addDays(start, 1))}`)
    } else {
      lines.push(`DTSTART:${utc(start)}`)
      lines.push(`DTEND:${utc(end)}`)
    }

    lines.push(`SUMMARY:${escape(slot.title)}`)
    if (slot.rrule) lines.push(`RRULE:${slot.rrule}`)
    if (slot.exdates) {
      for (const day of slot.exdates) {
        lines.push(`EXDATE:${utc(at(monday, day, slot.from))}`)
      }
    }
    if (slot.status) lines.push(`STATUS:${slot.status}`)
    if (slot.transp) lines.push(`TRANSP:${slot.transp}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  // Le format iCal impose CRLF.
  return `${lines.join('\r\n')}\r\n`
}

/** Instant du jour `day` (0 = lundi) à `hour` heures, en heure de Paris. */
function at(monday: Date, day: number, hour: number): Date {
  const base = addDays(monday, day)
  const w = wall(base)
  return fromWall(
    w.year,
    w.month,
    w.day,
    Math.floor(hour),
    Math.round((hour % 1) * 60),
  )
}

function utc(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

function date(d: Date): string {
  const w = wall(d)
  return `${w.year}${String(w.month).padStart(2, '0')}${String(w.day).padStart(2, '0')}`
}

function escape(value: string): string {
  return value.replace(/([,;\\])/g, '\\$1')
}
