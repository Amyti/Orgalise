import { addMonths, isoDay, startOfMonth, wall } from './dates'
import type { Category } from './types'

/**
 * Projection d'un mois : revenus, charges fixes, dépenses prévues.
 *
 * Revenus et charges fixes sont stockés comme des RÈGLES (montant + jour
 * du mois + bornes de validité), jamais dépliés en base. C'est ici qu'on
 * les projette sur un mois donné.
 */

export type Income = {
  id: string
  label: string
  amount_cents: number
  day_of_month: number
  starts_on: string
  ends_on: string | null
}

export type FixedCharge = Income & {
  category_id: string | null
}

/**
 * Une règle d'épargne mensuelle. `goal_id` à `null` = épargne libre.
 *
 * La forme vit ici, avec les autres règles projetables, plutôt que dans
 * `lib/goals.ts` — qui importe déjà ce module, et dont l'import en sens
 * inverse serait circulaire.
 */
export type SavingsRule = Income & {
  goal_id: string | null
}

export type PlannedExpense = {
  id: string
  label: string
  amount_cents: number
  category_id: string | null
  due_on: string
  settled_at: string | null
  expense_id: string | null
}

/** Une échéance projetée sur un mois précis. */
export type Occurrence = {
  id: string
  label: string
  amountCents: number
  /** Date réelle dans le mois, jour de fin ramené si le mois est court. */
  on: Date
  categoryId: string | null
  kind: 'income' | 'fixed' | 'planned' | 'savings'
  /** Pour une dépense prévue déjà pointée. */
  settled?: boolean
}

/**
 * Le nombre de jours du mois. Une charge au 31 doit tomber le 28 en
 * février, pas déborder sur mars.
 */
export function daysInMonth(month: Date): number {
  const w = wall(month)
  return new Date(Date.UTC(w.year, w.month, 0)).getUTCDate()
}

/** Date d'échéance dans ce mois, jour ramené au dernier si nécessaire. */
function dueDate(month: Date, dayOfMonth: number): Date {
  const w = wall(month)
  const day = Math.min(dayOfMonth, daysInMonth(month))
  return new Date(Date.UTC(w.year, w.month - 1, day, 12))
}

/** Une règle s'applique-t-elle à ce mois ? */
function appliesTo(rule: { starts_on: string; ends_on: string | null }, month: Date): boolean {
  const monthStart = isoDay(month)
  const monthEnd = isoDay(addMonths(month, 1))
  if (rule.starts_on >= monthEnd) return false
  if (rule.ends_on && rule.ends_on < monthStart) return false
  return true
}

export type MonthForecast = {
  month: Date
  incomes: Occurrence[]
  fixed: Occurrence[]
  planned: Occurrence[]
  /** Les virements d'épargne déclarés, projetés sur ce mois. */
  savings: Occurrence[]
  incomeCents: number
  fixedCents: number
  /** Prévu et pas encore payé : c'est ce qu'il faut encore mettre de côté. */
  plannedPendingCents: number
  /** Épargne déclarée ce mois-ci : ce qui part vraiment du compte. */
  declaredSavingsCents: number
  /** Épargne déclarée + retenue d'office par les objectifs sans règle. */
  savingsCents: number
  /** Revenus − charges − prévu restant − épargne. Ce qu'il y a à dépenser. */
  envelopeCents: number
}

export function forecastMonth(
  month: Date,
  incomes: Income[],
  fixed: FixedCharge[],
  planned: PlannedExpense[],
  /** Les virements d'épargne déclarés, projetés comme les charges fixes. */
  savings: SavingsRule[] = [],
  /*
   * Ce que l'épargne retire de l'enveloppe en plus des règles ci-dessus :
   * la retenue d'office des objectifs sans virement déclaré (`heldCents`)
   * et les versements ponctuels pris sur le budget du mois
   * (`entriesHeldCents`), tous deux calculés dans `lib/goals.ts`.
   *
   * Le passer en nombre plutôt qu'en listes garde ce module ignorant des
   * objectifs : il ne connaît qu'une somme qui sort de l'enveloppe.
   */
  extraSavingsCents = 0,
): MonthForecast {
  const start = startOfMonth(month)

  const incomeOcc: Occurrence[] = incomes
    .filter((i) => appliesTo(i, start))
    .map((i) => ({
      id: i.id,
      label: i.label,
      amountCents: i.amount_cents,
      on: dueDate(start, i.day_of_month),
      categoryId: null,
      kind: 'income' as const,
    }))

  const fixedOcc: Occurrence[] = fixed
    .filter((f) => appliesTo(f, start))
    .map((f) => ({
      id: f.id,
      label: f.label,
      amountCents: f.amount_cents,
      on: dueDate(start, f.day_of_month),
      categoryId: f.category_id,
      kind: 'fixed' as const,
    }))

  const savingsOcc: Occurrence[] = savings
    .filter((p) => appliesTo(p, start))
    .map((p) => ({
      id: p.id,
      label: p.label,
      amountCents: p.amount_cents,
      on: dueDate(start, p.day_of_month),
      categoryId: null,
      kind: 'savings' as const,
    }))

  const monthStart = isoDay(start)
  const monthEnd = isoDay(addMonths(start, 1))
  const plannedOcc: Occurrence[] = planned
    .filter((p) => p.due_on >= monthStart && p.due_on < monthEnd)
    .map((p) => ({
      id: p.id,
      label: p.label,
      amountCents: p.amount_cents,
      on: new Date(`${p.due_on}T12:00:00Z`),
      categoryId: p.category_id,
      kind: 'planned' as const,
      settled: p.settled_at !== null,
    }))

  const sum = (list: Occurrence[]) => list.reduce((t, o) => t + o.amountCents, 0)

  const incomeCents = sum(incomeOcc)
  const fixedCents = sum(fixedOcc)
  const plannedPendingCents = sum(plannedOcc.filter((p) => !p.settled))
  const declaredSavingsCents = sum(savingsOcc)
  const savingsCents = declaredSavingsCents + extraSavingsCents

  return {
    month: start,
    incomes: byDate(incomeOcc),
    fixed: byDate(fixedOcc),
    planned: byDate(plannedOcc),
    savings: byDate(savingsOcc),
    incomeCents,
    fixedCents,
    plannedPendingCents,
    declaredSavingsCents,
    savingsCents,
    envelopeCents: incomeCents - fixedCents - plannedPendingCents - savingsCents,
  }
}

function byDate(list: Occurrence[]): Occurrence[] {
  return [...list].sort((a, b) => a.on.getTime() - b.on.getTime())
}

/**
 * Le chiffre qui compte : ce qu'il reste à dépenser, et par jour.
 *
 * Les charges fixes déjà saisies comme dépenses réelles seraient comptées
 * deux fois — l'appelant passe donc le total des dépenses libres, hors
 * charges pointées.
 */
export type Remaining = {
  /** Enveloppe − dépenses déjà faites. Peut être négatif. */
  cents: number
  /** Jours restants dans le mois, aujourd'hui compris. Minimum 1. */
  days: number
  /** Ce qu'on peut dépenser par jour d'ici la fin du mois. */
  perDayCents: number
  /** Vrai si le mois affiché est le mois en cours. */
  current: boolean
}

export function remaining(
  forecast: MonthForecast,
  spentCents: number,
  now: Date,
): Remaining {
  const cents = forecast.envelopeCents - spentCents
  const w = wall(forecast.month)
  const nw = wall(now)
  const current = w.year === nw.year && w.month === nw.month

  const days = current
    ? Math.max(1, daysInMonth(forecast.month) - nw.day + 1)
    : daysInMonth(forecast.month)

  return {
    cents,
    days,
    perDayCents: Math.floor(cents / days),
    current,
  }
}

/** Échéances à venir sur les prochains jours, tous types confondus. */
export function upcoming(
  forecasts: MonthForecast[],
  from: Date,
  limit = 5,
): Occurrence[] {
  const fromTime = from.getTime()
  return forecasts
    .flatMap((f) => [...f.fixed, ...f.planned])
    .filter((o) => o.on.getTime() >= fromTime && !o.settled)
    .sort((a, b) => a.on.getTime() - b.on.getTime())
    .slice(0, limit)
}

/** Libellé de catégorie pour une échéance, avec repli. */
export function categoryOf(
  occurrence: Occurrence,
  byId: Map<string, Category>,
): Category | undefined {
  return occurrence.categoryId ? byId.get(occurrence.categoryId) : undefined
}
