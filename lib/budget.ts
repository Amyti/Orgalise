import { addMonths, isoDay, startOfMonth } from './dates'
import type { FixedCharge, Income, PlannedExpense, SavingsRule } from './forecast'
import { createClient } from './supabase/server'
import { withPaletteColors } from './categories'
import type { Budget, Category, Expense } from './types'
import type { Goal } from './goals'

/**
 * Budget personnel.
 *
 * CLAUDE.md : ce n'est pas un Tricount. Aucune notion de « qui doit quoi
 * à qui », et les policies RLS `user_id = auth.uid()` garantissent que
 * même dans un espace partagé, personne ne voit les dépenses de l'autre.
 * Rien ici ne prend donc de `group_id` : ce serait la porte ouverte.
 */

export type CategoryTotal = {
  category: Category
  cents: number
  /** Part du total du mois, en pourcentage. */
  share: number
}

export type MonthBudget = {
  month: Date
  expenses: Expense[]
  categories: Category[]
  byId: Map<string, Category>
  totals: CategoryTotal[]
  totalCents: number
  limitCents: number | null
  remainingCents: number | null
  /** Part du plafond consommée, 0 → 1 (peut dépasser 1). */
  ratio: number | null
}

/** Le 1er du mois, format `date` de Postgres. */
export function monthKey(date: Date): string {
  return isoDay(startOfMonth(date))
}

export async function loadMonth(date: Date): Promise<MonthBudget> {
  const supabase = await createClient()
  const month = startOfMonth(date)
  const next = addMonths(month, 1)

  const [{ data: expenses }, { data: categories }, { data: budget }] =
    await Promise.all([
      supabase
        .from('expenses')
        .select('id, category_id, amount_cents, label, spent_on, created_at')
        .gte('spent_on', isoDay(month))
        .lt('spent_on', isoDay(next))
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('id, name, color, position')
        .order('position'),
      supabase
        .from('budgets')
        .select('month, limit_cents')
        .eq('month', monthKey(month))
        .maybeSingle(),
    ])

  return summarise(
    month,
    (expenses ?? []) as Expense[],
    withPaletteColors((categories ?? []) as Category[]),
    (budget as Budget | null) ?? null,
  )
}

export function summarise(
  month: Date,
  expenses: Expense[],
  categories: Category[],
  budget: Budget | null,
): MonthBudget {
  const byId = new Map(categories.map((c) => [c.id, c]))

  const totalCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0)

  const sums = new Map<string, number>()
  for (const expense of expenses) {
    const key = expense.category_id ?? 'sans'
    sums.set(key, (sums.get(key) ?? 0) + expense.amount_cents)
  }

  const totals: CategoryTotal[] = [...sums.entries()]
    .map(([id, cents]) => ({
      category: byId.get(id) ?? {
        id: 'sans',
        name: 'Sans catégorie',
        color: '#BFB8B3', // --cat-autre
        position: 99,
      },
      cents,
      share: totalCents > 0 ? (cents / totalCents) * 100 : 0,
    }))
    .sort((a, b) => b.cents - a.cents)

  const limitCents = budget?.limit_cents ?? null

  return {
    month,
    expenses,
    categories,
    byId,
    totals,
    totalCents,
    limitCents,
    remainingCents: limitCents === null ? null : limitCents - totalCents,
    ratio: limitCents === null || limitCents === 0 ? null : totalCents / limitCents,
  }
}

export { groupByDay } from './expenses-shape'

/**
 * Tout ce qu'il faut pour le tableau de bord d'un mois : le réalisé, le
 * prévisionnel, et l'historique des six derniers mois pour la tendance.
 */
export async function loadDashboard(date: Date) {
  const supabase = await createClient()
  const month = startOfMonth(date)
  const next = addMonths(month, 1)
  const trendFrom = addMonths(month, -5)

  const [budget, incomes, fixed, planned, history, goals, savings] = await Promise.all([
    loadMonth(month),
    supabase
      .from('incomes')
      .select('id, label, amount_cents, day_of_month, starts_on, ends_on')
      .order('day_of_month'),
    supabase
      .from('fixed_charges')
      .select('id, label, amount_cents, category_id, day_of_month, starts_on, ends_on')
      .order('day_of_month'),
    supabase
      .from('planned_expenses')
      .select('id, label, amount_cents, category_id, due_on, settled_at, expense_id')
      .gte('due_on', isoDay(trendFrom))
      .lt('due_on', isoDay(addMonths(month, 3)))
      .order('due_on'),
    supabase
      .from('expenses')
      .select('amount_cents, spent_on')
      .gte('spent_on', isoDay(trendFrom))
      .lt('spent_on', isoDay(next)),
    // Dans la même vague : un objectif retient de l'argent sur
    // l'enveloppe, il fait partie du calcul du reste à vivre.
    supabase
      .from('savings_goals')
      .select('id, user_id, group_id, label, target_cents, saved_cents, target_on, hold_in_budget')
      .order('target_on'),
    supabase
      .from('savings_plans')
      .select('id, goal_id, label, amount_cents, day_of_month, starts_on, ends_on')
      .order('day_of_month'),
  ])

  return {
    budget,
    incomes: (incomes.data ?? []) as Income[],
    fixed: (fixed.data ?? []) as FixedCharge[],
    planned: (planned.data ?? []) as PlannedExpense[],
    history: (history.data ?? []) as { amount_cents: number; spent_on: string }[],
    // Vide tant que migrations/005 n'a pas été exécutée : l'écran
    // fonctionne sans, il ne montre simplement aucun objectif.
    goals: (goals.data ?? []) as Goal[],
    savings: (savings.data ?? []) as SavingsRule[],
  }
}

export { monthlyTrend } from './expenses-shape'
