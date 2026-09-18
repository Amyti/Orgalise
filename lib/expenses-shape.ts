import { addMonths, isoDay, startOfMonth } from './dates'
import type { Expense } from './types'

/**
 * Regroupements de dépenses, sans accès base.
 *
 * Volontairement séparé de `lib/budget.ts` : ce module est importé par un
 * composant client, et `budget.ts` tire le client Supabase serveur.
 */

/** Groupe par jour, du plus récent au plus ancien, avec le sous-total. */
export function groupByDay(expenses: Expense[]): {
  day: string
  cents: number
  rows: Expense[]
}[] {
  const groups = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const rows = groups.get(expense.spent_on)
    if (rows) rows.push(expense)
    else groups.set(expense.spent_on, [expense])
  }

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, rows]) => ({
      day,
      rows,
      cents: rows.reduce((sum, e) => sum + e.amount_cents, 0),
    }))
}

/** Totaux mensuels des six derniers mois, du plus ancien au plus récent. */
export function monthlyTrend(
  rows: { amount_cents: number; spent_on: string }[],
  upTo: Date,
  months = 6,
): { month: Date; cents: number }[] {
  const buckets = new Map<string, number>()
  for (const row of rows) {
    const key = row.spent_on.slice(0, 7)
    buckets.set(key, (buckets.get(key) ?? 0) + row.amount_cents)
  }

  return Array.from({ length: months }, (_, i) => {
    const month = addMonths(startOfMonth(upTo), i - (months - 1))
    return { month, cents: buckets.get(isoDay(month).slice(0, 7)) ?? 0 }
  })
}
