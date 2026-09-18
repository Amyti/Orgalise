'use server'

import { revalidatePath } from 'next/cache'

import { isoDay, parseIsoDay, startOfMonth } from '@/lib/dates'
import { parseCents } from '@/lib/money'
import { requireUser } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { ExpenseState } from './state'

/**
 * Revenus, charges fixes et dépenses prévues.
 *
 * Les deux premiers sont des règles : montant + jour du mois + bornes de
 * validité. On ne crée jamais une ligne par mois — une augmentation se
 * saisit en fermant l'ancienne règle et en ouvrant la nouvelle, ce qui
 * garde l'historique juste.
 */

function readAmount(formData: FormData): number | null {
  const cents = parseCents(String(formData.get('amount') ?? ''))
  return cents !== null && cents > 0 ? cents : null
}

function readDay(formData: FormData): number {
  const day = Number(formData.get('day_of_month'))
  if (!Number.isFinite(day)) return 1
  return Math.min(31, Math.max(1, Math.round(day)))
}

// --- Revenus ----------------------------------------------------------

export async function saveIncome(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const user = await requireUser()
  const id = String(formData.get('id') ?? '')
  const label = String(formData.get('label') ?? '').trim().slice(0, 60)
  const amount = readAmount(formData)

  if (!label) return { status: 'error', message: 'Donne un nom à ce revenu.' }
  if (amount === null) return { status: 'error', message: 'Entre un montant supérieur à zéro.' }

  const row = {
    label,
    amount_cents: amount,
    day_of_month: readDay(formData),
  }

  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('incomes').update(row).eq('id', id)
    : await supabase.from('incomes').insert({
        ...row,
        user_id: user.id,
        starts_on: isoDay(startOfMonth(new Date())),
      })

  if (error) return { status: 'error', message: "Le revenu n'a pas pu être enregistré." }

  revalidatePath('/budget', 'layout')
  return { status: 'idle', message: '' }
}

// --- Charges fixes ----------------------------------------------------

export async function saveFixedCharge(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const user = await requireUser()
  const id = String(formData.get('id') ?? '')
  const label = String(formData.get('label') ?? '').trim().slice(0, 60)
  const amount = readAmount(formData)
  const categoryId = String(formData.get('category_id') ?? '') || null

  if (!label) return { status: 'error', message: 'Donne un nom à cette charge.' }
  if (amount === null) return { status: 'error', message: 'Entre un montant supérieur à zéro.' }

  const row = {
    label,
    amount_cents: amount,
    category_id: categoryId,
    day_of_month: readDay(formData),
  }

  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('fixed_charges').update(row).eq('id', id)
    : await supabase.from('fixed_charges').insert({
        ...row,
        user_id: user.id,
        starts_on: isoDay(startOfMonth(new Date())),
      })

  if (error) return { status: 'error', message: "La charge n'a pas pu être enregistrée." }

  revalidatePath('/budget', 'layout')
  return { status: 'idle', message: '' }
}

// --- Dépenses prévues -------------------------------------------------

export async function savePlanned(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const user = await requireUser()
  const id = String(formData.get('id') ?? '')
  const label = String(formData.get('label') ?? '').trim().slice(0, 60)
  const amount = readAmount(formData)
  const categoryId = String(formData.get('category_id') ?? '') || null
  const dueOn = String(formData.get('due_on') ?? '')

  if (!label) return { status: 'error', message: 'Donne un nom à cette dépense.' }
  if (amount === null) return { status: 'error', message: 'Entre un montant supérieur à zéro.' }
  if (!parseIsoDay(dueOn)) return { status: 'error', message: "La date n'est pas valide." }

  const row = {
    label,
    amount_cents: amount,
    category_id: categoryId,
    due_on: dueOn,
  }

  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('planned_expenses').update(row).eq('id', id)
    : await supabase.from('planned_expenses').insert({ ...row, user_id: user.id })

  if (error) return { status: 'error', message: "La prévision n'a pas pu être enregistrée." }

  revalidatePath('/budget', 'layout')
  return { status: 'idle', message: '' }
}

/**
 * Pointer une dépense prévue.
 *
 * Crée la dépense réelle et garde le lien : sans ça, le montant serait
 * compté deux fois — une fois comme prévision à provisionner, une fois
 * comme dépense effective.
 */
export async function settlePlanned(formData: FormData): Promise<void> {
  const user = await requireUser()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const supabase = await createClient()
  const { data: planned } = await supabase
    .from('planned_expenses')
    .select('id, label, amount_cents, category_id, due_on, settled_at')
    .eq('id', id)
    .maybeSingle()

  if (!planned || planned.settled_at) return

  const { data: expense } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      category_id: planned.category_id,
      amount_cents: planned.amount_cents,
      label: planned.label,
      spent_on: planned.due_on,
    })
    .select('id')
    .single()

  await supabase
    .from('planned_expenses')
    .update({ settled_at: new Date().toISOString(), expense_id: expense?.id ?? null })
    .eq('id', id)

  revalidatePath('/budget', 'layout')
}

// --- Suppressions -----------------------------------------------------

export async function removeIncome(formData: FormData): Promise<void> {
  await remove('incomes', formData)
}

export async function removeFixedCharge(formData: FormData): Promise<void> {
  await remove('fixed_charges', formData)
}

export async function removePlanned(formData: FormData): Promise<void> {
  await remove('planned_expenses', formData)
}

async function remove(table: string, formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  await supabase.from(table).delete().eq('id', id)
  revalidatePath('/budget', 'layout')
}
