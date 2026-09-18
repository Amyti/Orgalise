/**
 * Dates et fuseaux.
 *
 * Règle de CLAUDE.md : tout est stocké en `timestamptz`, jamais d'heure
 * locale nue. Côté affichage il faut donc reprojeter dans le fuseau de
 * l'utilisateur — ici Europe/Paris — sans jamais se fier au fuseau du
 * serveur, qui est en UTC sur Vercel.
 */

export const TZ = 'Europe/Paris'

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export type Wall = {
  year: number
  month: number // 1–12
  day: number
  hour: number
  minute: number
  second: number
}

/** Décompose un instant en heure murale dans le fuseau. */
export function wall(date: Date): Wall {
  const p: Record<string, string> = {}
  for (const { type, value } of PARTS.formatToParts(date)) p[type] = value
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    // Intl rend « 24 » pour minuit en hour12:false selon les versions.
    hour: +p.hour % 24,
    minute: +p.minute,
    second: +p.second,
  }
}

/** Décalage du fuseau à cet instant, en millisecondes. */
function offsetMs(date: Date): number {
  const w = wall(date)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asUtc - date.getTime()
}

/**
 * Instant correspondant à une heure murale de Paris.
 * Deux passes : la première estimation peut tomber du mauvais côté d'un
 * changement d'heure, la seconde recale.
 */
export function fromWall(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = new Date(guess - offsetMs(new Date(guess)))
  return new Date(guess - offsetMs(first))
}

/** Minuit (heure de Paris) du jour qui contient `date`. */
export function startOfDay(date: Date): Date {
  const w = wall(date)
  return fromWall(w.year, w.month, w.day)
}

export function addDays(date: Date, n: number): Date {
  const w = wall(date)
  // Passe par l'heure murale : +1 jour ≠ +24 h les week-ends de changement d'heure.
  return fromWall(w.year, w.month, w.day + n, w.hour, w.minute)
}

/** Lundi 00 h 00 de la semaine qui contient `date`. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date)
  // getUTCDay sur l'heure murale : dimanche = 0, on veut lundi = 0.
  const w = wall(start)
  const dow = (new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay() + 6) % 7
  return addDays(start, -dow)
}

/** Premier jour du mois, à minuit. */
export function startOfMonth(date: Date): Date {
  const w = wall(date)
  return fromWall(w.year, w.month, 1)
}

export function addMonths(date: Date, n: number): Date {
  const w = wall(date)
  return fromWall(w.year, w.month + n, 1)
}

/** Les 7 jours de la semaine de `date`, à minuit chacun. */
export function weekDays(date: Date): Date[] {
  const monday = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/**
 * Grille du mois : toujours des semaines entières commençant lundi,
 * débordement sur les mois voisins compris.
 */
export function monthGrid(date: Date): Date[] {
  const first = startOfMonth(date)
  const start = startOfWeek(first)
  const end = addMonths(first, 1)
  const cells: Date[] = []
  for (let d = start; d < end || cells.length % 7 !== 0; d = addDays(d, 1)) {
    cells.push(d)
    if (cells.length > 42) break
  }
  return cells
}

export function sameDay(a: Date, b: Date): boolean {
  const x = wall(a)
  const y = wall(b)
  return x.year === y.year && x.month === y.month && x.day === y.day
}

/** Heure décimale dans la journée : 9 h 30 → 9.5. Sert au positionnement. */
export function decimalHour(date: Date, dayStart: Date): number {
  return (date.getTime() - dayStart.getTime()) / 3_600_000
}

/** `hours` heures après un instant. 19.5 → 19 h 30. */
export function hoursFrom(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * 3_600_000)
}

// ---------------------------------------------------------------------
// Formatage français
// ---------------------------------------------------------------------

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const JOURS_COURTS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const MOIS_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

/** 0 = lundi. */
export function weekdayIndex(date: Date): number {
  const w = wall(date)
  return (new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay() + 6) % 7
}

export function dayName(date: Date): string {
  return JOURS[weekdayIndex(date)]
}

export function dayShort(date: Date): string {
  return JOURS_COURTS[weekdayIndex(date)]
}

export function monthName(date: Date): string {
  return MOIS[wall(date).month - 1]
}

export function monthShort(date: Date): string {
  return MOIS_COURTS[wall(date).month - 1]
}

/** « Jeudi 17 septembre » */
export function longDate(date: Date): string {
  const w = wall(date)
  return `${dayName(date)} ${w.day} ${MOIS[w.month - 1]}`
}

/** « 17 sept. » */
export function shortDate(date: Date): string {
  const w = wall(date)
  return `${w.day} ${MOIS_COURTS[w.month - 1]}`
}

/** « 17/09 » */
export function numericDate(date: Date): string {
  const w = wall(date)
  return `${String(w.day).padStart(2, '0')}/${String(w.month).padStart(2, '0')}`
}

/** « 19 h 30 », « 14 h » — typographie française, espace avant l'unité. */
export function clock(date: Date): string {
  const w = wall(date)
  return w.minute === 0 ? `${w.hour} h` : `${w.hour} h ${String(w.minute).padStart(2, '0')}`
}

/** « 9 h – 13 h » */
export function timeRange(start: Date, end: Date): string {
  return `${clock(start)} – ${clock(end)}`
}

/** Durée lisible : 90 → « 1 h 30 », 45 → « 45 min ». */
export function duration(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`
}

/** « dans 6 heures », « dans 3 jours », « maintenant ». */
export function relative(date: Date, now: Date): string {
  const min = Math.round((date.getTime() - now.getTime()) / 60_000)
  if (min <= 0) return 'maintenant'
  if (min < 60) return `dans ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `dans ${h} heure${h > 1 ? 's' : ''}`
  const d = Math.round(h / 24)
  return `dans ${d} jour${d > 1 ? 's' : ''}`
}

/** « Aujourd'hui », « Hier », sinon « Lundi 15 septembre ». */
export function dayLabel(date: Date, today: Date): string {
  if (sameDay(date, today)) return "Aujourd'hui"
  if (sameDay(date, addDays(today, -1))) return 'Hier'
  if (sameDay(date, addDays(today, 1))) return 'Demain'
  return longDate(date)
}

/** Date ISO `YYYY-MM-DD` en heure murale — pour les colonnes `date`. */
export function isoDay(date: Date): string {
  const w = wall(date)
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`
}

/** Lit un `YYYY-MM-DD` d'URL comme un jour de Paris, à minuit. */
export function parseIsoDay(value: string | undefined | null): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const date = fromWall(+m[1], +m[2], +m[3])
  return Number.isNaN(date.getTime()) ? null : date
}

/** Valeur pour un `<input type="datetime-local">`, en heure de Paris. */
export function inputValue(date: Date): string {
  const w = wall(date)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${w.year}-${p(w.month)}-${p(w.day)}T${p(w.hour)}:${p(w.minute)}`
}

/**
 * Lit un `<input type="datetime-local">` — ou un `type="date"` quand
 * l'événement dure toute la journée — comme une heure de Paris.
 */
export function parseInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value)
  if (!m) return null
  const date = fromWall(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0)
  return Number.isNaN(date.getTime()) ? null : date
}
