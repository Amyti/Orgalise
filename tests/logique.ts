/**
 * Contrôles de la logique métier — hors React, hors base.
 *
 * Couvre exactement ce que CLAUDE.md signale comme coûteux :
 * les fuseaux (§ décision 4), la récurrence RRULE/EXDATE (§ décision 3),
 * l'import ICS qui ne doit jamais laisser fuir un titre (§ décision 5),
 * et les montants en centimes entiers (§ décision 2).
 *
 *   npm test
 */
import {
  addDays, clock, duration, fromWall, isoDay, monthGrid, parseInputValue,
  parseIsoDay, startOfWeek, timeRange, wall, weekDays,
} from '../lib/dates'
import { complement, merge, minutes } from '../lib/intervals'
import { euros, parseCents } from '../lib/money'
import { expand } from '../lib/recurrence'
import { busyBlocks } from '../lib/ics'
import { computeBand, bandTicks, bandHours, splitDays, WEEK_BAND } from '../lib/agenda'
import { daysInMonth, forecastMonth, remaining } from '../lib/forecast'
import { monthlyTrend } from '../lib/expenses-shape'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : '  ÉCHEC'} ${name}${ok ? '' : `\n         attendu ${e}\n         obtenu  ${a}`}`)
}

console.log('\n— Fuseaux et dates —')
// 17 septembre 2026, 19 h 30 à Paris = 17 h 30 UTC (heure d'été)
check('heure d’été', fromWall(2026, 9, 17, 19, 30).toISOString(), '2026-09-17T17:30:00.000Z')
// 17 janvier 2026, 19 h 30 à Paris = 18 h 30 UTC (heure d'hiver)
check('heure d’hiver', fromWall(2026, 1, 17, 19, 30).toISOString(), '2026-01-17T18:30:00.000Z')
// Le passage à l'heure d'hiver 2026 a lieu le 25 octobre : +1 jour doit
// rester à la même heure murale, pas glisser d'une heure.
const veille = fromWall(2026, 10, 24, 20, 0)
check('+1 jour au changement d’heure', clock(addDays(veille, 1)), '20 h')
check('lundi de la semaine', isoDay(startOfWeek(fromWall(2026, 9, 17))), '2026-09-14')
check('7 jours dans la semaine', weekDays(fromWall(2026, 9, 17)).length, 7)
check('grille du mois = semaines entières', monthGrid(fromWall(2026, 9, 1)).length % 7, 0)
check('grille commence un lundi', isoDay(monthGrid(fromWall(2026, 9, 1))[0]), '2026-08-31')
check('lecture datetime-local', parseInputValue('2026-09-17T19:30')!.toISOString(), '2026-09-17T17:30:00.000Z')
check('lecture date seule', parseInputValue('2026-09-17')!.toISOString(), '2026-09-16T22:00:00.000Z')
check('URL YYYY-MM-DD', isoDay(parseIsoDay('2026-09-17')!), '2026-09-17')
check('plage horaire', timeRange(fromWall(2026, 9, 17, 9), fromWall(2026, 9, 17, 13)), '9 h – 13 h')
check('durée 90 min', duration(90), '1 h 30')
check('durée 45 min', duration(45), '45 min')

console.log('\n— Intervalles —')
const d = (h: number) => fromWall(2026, 9, 17, Math.floor(h), Math.round((h % 1) * 60))
check('fusion de chevauchements',
  merge([{ start: d(9), end: d(13) }, { start: d(12), end: d(15) }]).length, 1)
check('fusion de plages disjointes',
  merge([{ start: d(9), end: d(11) }, { start: d(14), end: d(16) }]).length, 2)
const libre = complement(
  [{ start: d(9), end: d(13) }, { start: d(14), end: d(18) }],
  d(7), d(23),
)
check('complément : 3 trous', libre.length, 3)
check('trou du midi', timeRange(libre[1].start, libre[1].end), '13 h – 14 h')
check('minutes du trou', minutes(libre[1]), 60)

console.log('\n— Montants —')
check('centimes → euros', euros(56429), '564,29 €')
check('milliers séparés', euros(123456), '1\u202f234,56 €')
check('saisie virgule', parseCents('12,50'), 1250)
check('saisie point', parseCents('12.5'), 1250)
check('saisie entière', parseCents('800'), 80000)
check('saisie invalide', parseCents('abc'), null)
check('pas de float', Number.isInteger(parseCents('0,07')), true)
check('centime unique', parseCents('0,07'), 7)

console.log('\n— Récurrence (RRULE + EXDATE) —')
const serie = {
  starts_at: fromWall(2026, 9, 15, 20, 0).toISOString(),
  ends_at: fromWall(2026, 9, 15, 22, 0).toISOString(),
  rrule: 'FREQ=WEEKLY',
  exdates: null,
}
const occ = expand([serie], fromWall(2026, 9, 14), fromWall(2026, 10, 13))
check('4 mardis dépliés', occ.length, 4)
check('toujours 20 h après le 25 octobre',
  expand([{ ...serie, rrule: 'FREQ=WEEKLY' }], fromWall(2026, 10, 26), fromWall(2026, 11, 3))
    .map((o) => clock(o.start)), ['20 h'])
const avecExdate = expand(
  [{ ...serie, exdates: [fromWall(2026, 9, 22, 20, 0).toISOString()] }],
  fromWall(2026, 9, 14), fromWall(2026, 10, 13),
)
check('EXDATE retire une occurrence', avecExdate.length, 3)
check('jamais déplié en base', serie.rrule, 'FREQ=WEEKLY')

console.log('\n— Import ICS —')
const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//FR
BEGIN:VEVENT
UID:a@test
DTSTART:20260917T070000Z
DTEND:20260917T110000Z
SUMMARY:Secret professionnel
END:VEVENT
BEGIN:VEVENT
UID:b@test
DTSTART:20260917T120000Z
DTEND:20260917T130000Z
SUMMARY:Annulé
STATUS:CANCELLED
END:VEVENT
BEGIN:VEVENT
UID:c@test
DTSTART;VALUE=DATE:20260917
DTEND;VALUE=DATE:20260918
SUMMARY:Anniversaire
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
UID:d@test
DTSTART:20260917T140000Z
DTEND:20260917T150000Z
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Point quotidien
END:VEVENT
END:VCALENDAR`
const parsed = busyBlocks(ics, fromWall(2026, 9, 16), fromWall(2026, 9, 21))
check('événement annulé ignoré', parsed.busy.some((b) => b.start.toISOString() === '2026-09-17T12:00:00.000Z'), false)
check('journée entière transparente ignorée', parsed.busy.length, 4)
check('RRULE ICS dépliée (3 jours)', parsed.busy.filter((b) => b.start.getUTCHours() === 14).length, 3)
check('aucun titre ne sort', JSON.stringify(parsed.busy).includes('Secret'), false)

console.log('\n— Budget prévisionnel —')
check('jours de février 2026', daysInMonth(fromWall(2026, 2, 1)), 28)
check('jours de septembre', daysInMonth(fromWall(2026, 9, 1)), 30)

const salaire = {
  id: 's', label: 'Salaire', amount_cents: 210000,
  day_of_month: 1, starts_on: '2026-01-01', ends_on: null,
}
const loyer = {
  id: 'l', label: 'Loyer', amount_cents: 82000, category_id: null,
  day_of_month: 31, starts_on: '2026-01-01', ends_on: null,
}
const impots = {
  id: 'i', label: 'Impôts', amount_cents: 15000, category_id: null,
  due_on: '2026-09-15', settled_at: null, expense_id: null,
}

const f = forecastMonth(fromWall(2026, 9, 1), [salaire], [loyer], [impots])
check('revenus projetés', f.incomeCents, 210000)
check('charges fixes projetées', f.fixedCents, 82000)
check('prévu non payé', f.plannedPendingCents, 15000)
check('enveloppe = 2100 − 820 − 150', f.envelopeCents, 113000)

// Une charge au 31 doit tomber le 28 en février, pas déborder sur mars.
const fev = forecastMonth(fromWall(2026, 2, 1), [salaire], [loyer], [])
check('charge du 31 ramenée au 28 février', isoDay(fev.fixed[0].on), '2026-02-28')

// Une règle fermée ne compte plus.
const ferme = forecastMonth(
  fromWall(2026, 9, 1),
  [{ ...salaire, ends_on: '2026-08-31' }], [], [],
)
check('règle expirée ignorée', ferme.incomeCents, 0)
// Une règle qui commence plus tard non plus.
const futur = forecastMonth(
  fromWall(2026, 9, 1),
  [{ ...salaire, starts_on: '2026-10-01' }], [], [],
)
check('règle pas encore commencée ignorée', futur.incomeCents, 0)

// Une prévision pointée sort du « à provisionner » : elle est devenue
// une vraie dépense, la compter deux fois serait le bug classique.
const paye = forecastMonth(
  fromWall(2026, 9, 1), [salaire], [loyer],
  [{ ...impots, settled_at: '2026-09-15T10:00:00Z' }],
)
check('prévision pointée non provisionnée', paye.plannedPendingCents, 0)
check('enveloppe sans la prévision payée', paye.envelopeCents, 128000)

// 564,29 € dépensés le 17 septembre : 14 jours restants sur 30.
const reste = remaining(f, 56429, fromWall(2026, 9, 17, 12))
check('reste à vivre', reste.cents, 113000 - 56429)
check('jours restants, aujourd’hui compris', reste.days, 14)
check('par jour', reste.perDayCents, Math.floor((113000 - 56429) / 14))
check('mois passé : mois entier', remaining(f, 0, fromWall(2026, 11, 5)).days, 30)

const trend = monthlyTrend(
  [{ amount_cents: 1000, spent_on: '2026-09-03' },
   { amount_cents: 2000, spent_on: '2026-09-20' },
   { amount_cents: 500,  spent_on: '2026-07-11' }],
  fromWall(2026, 9, 1),
)
check('six mois de tendance', trend.length, 6)
check('total du mois courant', trend[5].cents, 3000)
check('mois sans dépense = 0', trend[4].cents, 0)
check('mois plus ancien retrouvé', trend[3].cents, 500)

console.log('\n— Bande horaire adaptative —')
const jour = fromWall(2026, 9, 17)
const iv = (h1: number, h2: number) => ({
  start: fromWall(2026, 9, 17, Math.floor(h1), Math.round((h1 % 1) * 60)),
  end: fromWall(2026, 9, 17, Math.floor(h2), Math.round((h2 % 1) * 60)),
})
const vue = (mine: any[], theirs: any[] = [], events: any[] = []) => ({
  date: jour, start: jour, end: fromWall(2026, 9, 18),
  mine, theirs, events, free: [], freeMinutes: 0,
})

check('journée ordinaire : bande inchangée',
  computeBand([vue([iv(9, 18)])]), { from: 7, to: 23 })
// Le cas de la garde à 5 h : sans extension, le ruban serait invisible.
check('début à 5 h : la bande descend',
  computeBand([vue([iv(5, 13)])]).from, 5)
check('fin à minuit : la bande monte',
  computeBand([vue([iv(20, 24)])]).to, 24)
check('demi-heure : bornes arrondies vers l’extérieur',
  computeBand([vue([iv(5.5, 23.5)])]), { from: 5, to: 24 })
check('la bande ne rétrécit jamais',
  computeBand([vue([iv(10, 11)])]), { from: 7, to: 23 })
// Une journée entière irait de 0 h à 24 h et écraserait toutes les autres.
check('journée entière ignorée',
  computeBand([vue([], [], [
    { event: { all_day: true }, start: jour, end: fromWall(2026, 9, 18) },
  ])]), { from: 7, to: 23 })
check('événement daté pris en compte',
  computeBand([vue([], [], [
    { event: { all_day: false }, start: fromWall(2026, 9, 17, 6), end: fromWall(2026, 9, 17, 8) },
  ])]).from, 6)
// Une seule bande pour toute la vue : c'est le plus large qui gagne.
check('bande commune à plusieurs jours',
  computeBand([vue([iv(9, 18)]), vue([iv(5, 7)]), vue([iv(20, 24)])]),
  { from: 5, to: 24 })
check('l’autre personne compte aussi',
  computeBand([vue([], [iv(4, 9)])]).from, 4)

check('4 repères sur 7 h – 23 h', bandTicks({ from: 7, to: 23 }, 4), [7, 12, 18, 23])
check('4 repères sur une bande étendue', bandTicks({ from: 5, to: 24 }, 4), [5, 11, 18, 24])
check('heures pleines, pas de 2', bandHours({ from: 5, to: 13 }, 2), [5, 7, 9, 11, 13])
check('bande à bornes décimales', bandHours({ from: 5.5, to: 12 }, 2), [6, 8, 10, 12])

console.log(`\n${failures === 0 ? '✓ tout passe' : `✗ ${failures} échec(s)`}\n`)
process.exit(failures === 0 ? 0 : 1)
