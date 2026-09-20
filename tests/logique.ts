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
import { readTokenClaims, isFresh } from '../lib/supabase/token'
import { daysInMonth, forecastMonth, remaining } from '../lib/forecast'
import { monthlyTrend } from '../lib/expenses-shape'
import { parseExpenseJson, promptFor, rowKey, totalCents, MAX_ROWS } from '../lib/import'
import { declaredByGoal, entriesHeldCents, heldCents, monthsBetween, statusOf, type Goal, type SavingsEntry } from '../lib/goals'
import type { SavingsRule } from '../lib/forecast'

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

console.log('\n— Lecture locale du jeton de session —')
const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (claims: object) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.signature`
const cookie = (session: object) =>
  'base64-' + Buffer.from(JSON.stringify(session)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const SUB = '11111111-2222-3333-4444-555555555555'
const dans1h = Math.floor(Date.now() / 1000) + 3600
const session = { access_token: jwt({ sub: SUB, exp: dans1h }), token_type: 'bearer' }
const valeur = cookie(session)

check('cookie entier', readTokenClaims([{ name: 'sb-abc-auth-token', value: valeur }])?.sub, SUB)
// @supabase/ssr découpe les gros cookies ; l'ordre n'est pas garanti.
const moitie = Math.ceil(valeur.length / 2)
check('cookie découpé, dans le désordre', readTokenClaims([
  { name: 'sb-abc-auth-token.1', value: valeur.slice(moitie) },
  { name: 'sb-abc-auth-token.0', value: valeur.slice(0, moitie) },
])?.sub, SUB)
// Un morceau manquant donnerait du JSON tronqué : mieux vaut abandonner.
check('morceau manquant → abandon', readTokenClaims([
  { name: 'sb-abc-auth-token.0', value: valeur.slice(0, moitie) },
  { name: 'sb-abc-auth-token.2', value: valeur.slice(moitie) },
]), null)
check('aucun cookie', readTokenClaims([]), null)
check('cookie étranger ignoré', readTokenClaims([{ name: 'autre', value: valeur }]), null)
check('valeur illisible → abandon', readTokenClaims([
  { name: 'sb-abc-auth-token', value: 'base64-pasdubase64!!' }]), null)
check('JSON sans access_token → abandon', readTokenClaims([
  { name: 'sb-abc-auth-token', value: cookie({ autre: 1 }) }]), null)
check('JWT sans sub → abandon', readTokenClaims([
  { name: 'sb-abc-auth-token', value: cookie({ access_token: jwt({ exp: dans1h }) }) }]), null)

// La fraîcheur décide si l'on peut éviter l'appel réseau.
check('jeton d’une heure : frais', isFresh({ sub: SUB, exp: dans1h }), true)
check('expire dans 30 s : pas frais', isFresh({ sub: SUB, exp: Math.floor(Date.now()/1000) + 30 }), false)
check('déjà expiré : pas frais', isFresh({ sub: SUB, exp: Math.floor(Date.now()/1000) - 10 }), false)

// ---------------------------------------------------------------------
// Import d'un JSON de dépenses écrit par une IA.
// Ce qui arrive là n'est pas une API : c'est du texte de modèle, donc
// irrégulier. Chaque tolérance ci-dessous répond à une forme observée.
// ---------------------------------------------------------------------
const CATS = ['Courses', 'Resto', 'Transport', 'Loisirs', 'Logement', 'Santé', 'Abonnements', 'Autre']
const lire = (raw: string) => parseExpenseJson(raw, CATS)

check('cas nominal', lire('[{"date":"2026-09-14","libelle":"Carrefour","montant":42.9,"categorie":"Courses"}]').rows,
  [{ label: 'Carrefour', amountCents: 4290, spentOn: '2026-09-14', categoryName: 'Courses' }])

// 42.90 * 100 vaut 4289,9999… en binaire : l'arrondi n'est pas cosmétique.
check('centimes entiers, jamais de float', lire('[{"date":"2026-09-14","libelle":"x","montant":42.90,"categorie":"Autre"}]').rows[0].amountCents, 4290)
check('montant en chaîne française', lire('[{"date":"2026-09-14","libelle":"x","montant":"12,50 €"}]').rows[0].amountCents, 1250)
// Un relevé note les débits en négatif ; l'app ne stocke que du positif.
check('débit négatif ramené au positif', lire('[{"date":"2026-09-14","libelle":"x","montant":-8.4}]').rows[0].amountCents, 840)

// Les modèles rendent volontiers leur réponse dans un bloc de code.
check('bloc Markdown déballé', lire('```json\n[{"date":"2026-09-14","libelle":"x","montant":3}]\n```').rows.length, 1)
check('objet enveloppant', lire('{"depenses":[{"date":"2026-09-14","libelle":"x","montant":3}]}').rows.length, 1)
check('dépense unique sans tableau', lire('{"date":"2026-09-14","libelle":"x","montant":3}').rows.length, 1)

// Les noms de clés varient d'une génération à l'autre.
check('alias de clés', lire('[{"jour":"14/09/2026","description":"Uber","prix":"9,90","type":"transport"}]').rows,
  [{ label: 'Uber', amountCents: 990, spentOn: '2026-09-14', categoryName: 'Transport' }])
check('clé accentuée', lire('[{"date":"2026-09-14","libellé":"x","montant":3,"catégorie":"Santé"}]').rows[0].categoryName, 'Santé')

check('date française', lire('[{"date":"03/01/2026","libelle":"x","montant":3}]').rows[0].spentOn, '2026-01-03')
check('année sur deux chiffres', lire('[{"date":"03/01/26","libelle":"x","montant":3}]').rows[0].spentOn, '2026-01-03')
check('31 février refusé', lire('[{"date":"2026-02-31","libelle":"x","montant":3}]').rejects[0].reason, 'date illisible')

// Aucune catégorie n'est créée depuis un import : deux orthographes
// feraient deux tranches dans le tableau de bord.
check('catégorie inconnue → Autre', lire('[{"date":"2026-09-14","libelle":"x","montant":3,"categorie":"Alimentation"}]').rows[0].categoryName, 'Autre')
check('« Restaurant » rejoint « Resto »', lire('[{"date":"2026-09-14","libelle":"x","montant":3,"categorie":"Restaurant"}]').rows[0].categoryName, 'Resto')
check('catégorie absente → Autre', lire('[{"date":"2026-09-14","libelle":"x","montant":3}]').rows[0].categoryName, 'Autre')

// Une ligne bancale ne doit pas emporter les bonnes avec elle.
const melange = lire('[{"date":"2026-09-14","libelle":"bon","montant":3},{"date":"n/a","libelle":"y","montant":4},{"date":"2026-09-15","montant":5}]')
check('les lignes valides survivent', melange.rows.length, 1)
check('les autres sont nommées', melange.rejects.map((r) => r.reason), ['date illisible', 'intitulé manquant'])
check('rang conservé pour retrouver la ligne', melange.rejects[0].index, 1)

// La forme compacte : quatre valeurs au lieu de quatre paires clé/valeur.
// C'est la sortie qui coûte le plus cher au jeton, d'où ce format.
check('forme compacte', lire('[["2026-09-14","Carrefour",42.9,"Courses"]]').rows,
  [{ label: 'Carrefour', amountCents: 4290, spentOn: '2026-09-14', categoryName: 'Courses' }])
// L'ordre annoncé n'est pas l'ordre garanti : chaque valeur est
// reconnue à sa nature, pas à sa position.
check('ordre inversé', lire('[[42.9,"Courses","Carrefour","2026-09-14"]]').rows[0],
  { label: 'Courses', amountCents: 4290, spentOn: '2026-09-14', categoryName: 'Autre' })
check('montant compact en chaîne', lire('[["2026-09-14","Carrefour","42,90","Courses"]]').rows[0].amountCents, 4290)
check('compact sans catégorie', lire('[["2026-09-14","Carrefour",42.9]]').rows[0].categoryName, 'Autre')
check('compact tronqué → refusé', lire('[["Carrefour"]]').rejects[0].reason, 'montant illisible')
// Les deux formes cohabitent : une IA tierce peut encore rendre des objets.
check('objets et tableaux mêlés', lire('[["2026-09-14","a",1,"Courses"],{"date":"2026-09-15","libelle":"b","montant":2}]').rows.length, 2)

// Une dépense ne peut pas être dans le futur : un modèle qui se trompe
// d'année le fait sans le dire, et la ligne part dans un mois qu'on ne
// regardera jamais.
const maintenant = fromWall(2026, 9, 20)
const lireAu = (raw: string) => parseExpenseJson(raw, CATS, maintenant)
check('date future écartée',
  lireAu('[["2027-01-05","x",3]]').rejects[0].reason, 'date dans le futur')
check("aujourd'hui accepté", lireAu('[["2026-09-20","x",3]]').rows.length, 1)
check('demain refusé', lireAu('[["2026-09-21","x",3]]').rows.length, 0)
check('le passé reste accepté', lireAu('[["2024-09-14","x",3]]').rows.length, 1)

// L'invite doit situer le modèle dans le temps, sinon il invente l'année.
const invite = promptFor(CATS, maintenant)
check("l'invite donne la date du jour", invite.includes('20 septembre 2026'), true)
check("l'invite nomme l'année précédente", invite.includes('2025'), true)
check("l'invite liste les catégories", invite.includes('Abonnements'), true)
check("l'invite écarte les crédits", invite.includes('virement reçu'), true)

check('montant nul écarté', lire('[{"date":"2026-09-14","libelle":"x","montant":0}]').rejects[0].reason, 'montant nul')
// Le modèle n'est plus bâillonné par un préremplissage : il peut
// introduire sa réponse, et on doit savoir isoler le tableau.
check('préambule ignoré',
  lire('Voici les 2 opérations relevées :\n[["2026-09-14","a",3],["2026-09-15","b",4]]').rows.length, 2)
check('préambule et conclusion',
  lire('J\'ai trouvé ceci :\n[["2026-09-14","a",3]]\nDis-moi si besoin.').rows.length, 1)
// Un libellé contenant un crochet ne doit pas couper le tableau.
check('crochet dans un libellé',
  lire('Réponse : [["2026-09-14","Café [gare]",3],["2026-09-15","b",4]]').rows.length, 2)
check('libellé avec crochet préservé',
  lire('Réponse : [["2026-09-14","Café [gare]",3]]').rows[0].label, 'Café [gare]')
// Un objet enveloppant noyé dans du texte se retrouve aussi.
check('objet enveloppant précédé de texte',
  lire('Voilà : {"depenses":[["2026-09-14","a",3]]}').rows.length, 1)

check('texte libre refusé', lire('bonjour').error !== null, true)
check('liste vide signalée', lire('[]').error, 'La liste est vide.')
check('vide → rien, sans erreur', lire('   '), { rows: [], rejects: [], error: null })

const trop = lire(JSON.stringify(Array.from({ length: MAX_ROWS + 5 }, () => ({ date: '2026-09-14', libelle: 'x', montant: 1 }))))
check('plafond de lignes respecté', trop.rows.length, MAX_ROWS)

check('total en centimes', totalCents(lire('[{"date":"2026-09-14","libelle":"a","montant":10},{"date":"2026-09-14","libelle":"b","montant":5.5}]').rows), 1550)
// La clé de doublon ignore la casse et les accents de l'intitulé.
check('clé de doublon insensible à la casse', rowKey({ spentOn: '2026-09-14', amountCents: 300, label: 'Café' }),
  rowKey({ spentOn: '2026-09-14', amountCents: 300, label: 'CAFE' }))

// ---------------------------------------------------------------------
// Objectifs d'épargne.
// Le chiffre qui compte est le montant mensuel, pas la progression.
// ---------------------------------------------------------------------
const objectif = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', user_id: 'u1', group_id: null, label: 'Apport',
  target_cents: 1_000_000, saved_cents: 0, target_on: '2027-06-01',
  hold_in_budget: true, ...over,
})
const sept = fromWall(2026, 9, 20)

check('mois pleins entre deux dates', monthsBetween(sept, fromWall(2027, 6, 1)), 9)
check('même mois → zéro', monthsBetween(sept, fromWall(2026, 9, 30)), 0)

// 10 000 € en 9 mois : c'est ce montant-là qui rend l'objectif parlant.
check('montant mensuel', statusOf(objectif(), sept).monthlyCents, 111112)
check('déjà épargné déduit', statusOf(objectif({ saved_cents: 550_000 }), sept).monthlyCents, 50000)
check('progression', statusOf(objectif({ saved_cents: 250_000 }), sept).ratio, 0.25)

// Un objectif atteint ne réclame plus rien, et ne pèse plus.
const atteint = statusOf(objectif({ saved_cents: 1_000_000 }), sept)
check('objectif atteint', [atteint.done, atteint.monthlyCents], [true, 0])
check('jamais de reste négatif', statusOf(objectif({ saved_cents: 1_200_000 }), sept).remainingCents, 0)
check('progression plafonnée à 1', statusOf(objectif({ saved_cents: 1_200_000 }), sept).ratio, 1)

// Une échéance passée ne doit pas diviser par zéro : il reste ce mois-ci.
const enRetard = statusOf(objectif({ target_on: '2026-08-01' }), sept)
check('échéance passée → en retard', enRetard.late, true)
check('échéance passée → le solde d’un coup', enRetard.monthlyCents, 1_000_000)
// Échéance dans le mois en cours : en retard, non — il reste des jours.
check('échéance ce mois-ci', statusOf(objectif({ target_on: '2026-09-30' }), sept).late, false)

// Un objectif commun se partage en deux parts égales.
const commun = statusOf(objectif({ group_id: 'grp' }), sept)
check('part d’un objectif commun', [commun.shared, commun.shareCents], [true, 55556])
check('objectif personnel : tout pour soi', statusOf(objectif(), sept).shareCents, 111112)

// Ce qui pèse sur l'enveloppe : coché, ni atteint, ni en retard.
check('ponction sur l’enveloppe', heldCents([
  statusOf(objectif(), sept),
  statusOf(objectif({ id: 'g2', hold_in_budget: false }), sept),
  statusOf(objectif({ id: 'g3', saved_cents: 1_000_000 }), sept),
  statusOf(objectif({ id: 'g4', target_on: '2026-08-01' }), sept),
]), 111112)
check('aucun objectif → rien à retenir', heldCents([]), 0)

// --- Ce qu'on met VRAIMENT de côté, face à ce qu'il faudrait ----------
// L'écart entre les deux est le seul message utile : « 40 % atteints »
// ne dit jamais si le rythme suffit.
const verse300 = statusOf(objectif(), sept, 30_000)
check('projection au rythme déclaré', verse300.projectedCents, 270_000)
check('manque à l’arrivée', verse300.shortfallCents, 730_000)
check('le nécessaire reste affiché', verse300.monthlyCents, 111112)

// Au bon rythme, il ne manque rien.
check('rythme suffisant', statusOf(objectif(), sept, 111_112).shortfallCents, 0)
check('sans versement, projection = épargne actuelle',
  statusOf(objectif({ saved_cents: 200_000 }), sept).projectedCents, 200_000)

// Dès qu'un versement est déclaré, c'est LUI qui sort de l'enveloppe —
// pas le montant théorique, qu'on ne verse pas.
check('le déclaré prime sur le calculé', heldCents([statusOf(objectif(), sept, 30_000)]), 0)
check('sans déclaration, on retient le nécessaire',
  heldCents([statusOf(objectif(), sept)]), 111112)

const regle = (over: Partial<SavingsRule> = {}): SavingsRule => ({
  id: 'p1', goal_id: 'g1', label: 'Virement', amount_cents: 30_000,
  day_of_month: 5, starts_on: '2026-01-01', ends_on: null, ...over,
})
const totaux = declaredByGoal([
  regle(), regle({ id: 'p2', amount_cents: 10_000 }),
  regle({ id: 'p3', goal_id: null, amount_cents: 5_000 }),
])
check('versements cumulés par objectif', totaux.get('g1'), 40_000)
check('épargne libre sous la clé nulle', totaux.get(null), 5_000)
check('aucune règle → aucune entrée', declaredByGoal([]).size, 0)

// --- Versements ponctuels --------------------------------------------
// Une prime n'a jamais transité par l'enveloppe : la compter ferait
// plonger le reste à vivre un mois où l'on a reçu de l'argent.
const versement = (over: Partial<SavingsEntry> = {}): SavingsEntry => ({
  id: 'e1', goal_id: 'g1', label: 'Prime', amount_cents: 200_000,
  on_date: '2026-09-14', from_envelope: false, ...over,
})
const debut = '2026-09-01'
const fin = '2026-10-01'

check('rentrée exceptionnelle : neutre sur l’enveloppe',
  entriesHeldCents([versement()], debut, fin), 0)
check('versement pris sur le mois : il en sort',
  entriesHeldCents([versement({ from_envelope: true })], debut, fin), 200_000)
check('versement d’un autre mois : ignoré',
  entriesHeldCents([versement({ from_envelope: true, on_date: '2026-08-31' })], debut, fin), 0)
check('dernier jour du mois : compté',
  entriesHeldCents([versement({ from_envelope: true, on_date: '2026-09-30' })], debut, fin), 200_000)
check('premier du mois suivant : exclu',
  entriesHeldCents([versement({ from_envelope: true, on_date: '2026-10-01' })], debut, fin), 0)
check('plusieurs versements cumulés', entriesHeldCents([
  versement({ from_envelope: true }),
  versement({ id: 'e2', from_envelope: true, amount_cents: 50_000 }),
  versement({ id: 'e3' }),
], debut, fin), 250_000)

console.log(`\n${failures === 0 ? '✓ tout passe' : `✗ ${failures} échec(s)`}\n`)
process.exit(failures === 0 ? 0 : 1)
