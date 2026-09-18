'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { monthKey } from '@/lib/budget'
import { parseIsoDay } from '@/lib/dates'
import { parseCents } from '@/lib/money'
import { requireUser } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { ExpenseState } from './state'

/** Enregistre une dépense. Montant en centiers de centimes : jamais de float. */
export async function saveExpense(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const user = await requireUser()

  const cents = parseCents(String(formData.get('amount') ?? ''))
  const label = String(formData.get('label') ?? '').trim().slice(0, 80)
  const categoryId = String(formData.get('category_id') ?? '') || null
  const spentOn = parseIsoDay(String(formData.get('spent_on') ?? ''))

  if (cents === null || cents <= 0) {
    return { status: 'error', message: 'Entre un montant supérieur à zéro.' }
  }
  if (!label) return { status: 'error', message: "Mets un intitulé, même court." }
  if (!spentOn) return { status: 'error', message: "La date n'est pas valide." }

  const supabase = await createClient()
  const { error } = await supabase.from('expenses').insert({
    user_id: user.id,
    category_id: categoryId,
    amount_cents: cents,
    label,
    spent_on: String(formData.get('spent_on')),
  })

  if (error) {
    return { status: 'error', message: "La dépense n'a pas pu être enregistrée." }
  }

  revalidatePath('/', 'layout')
  redirect('/budget')
}

export async function deleteExpense(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  await supabase.from('expenses').delete().eq('id', id)
  revalidatePath('/', 'layout')
}

/** Plafond du mois. `0` ou vide retire le plafond. */
export async function setLimit(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const user = await requireUser()
  const month = parseIsoDay(String(formData.get('month') ?? '')) ?? new Date()
  const cents = parseCents(String(formData.get('limit') ?? ''))

  const supabase = await createClient()

  if (cents === null || cents <= 0) {
    await supabase
      .from('budgets')
      .delete()
      .eq('user_id', user.id)
      .eq('month', monthKey(month))
  } else {
    const { error } = await supabase
      .from('budgets')
      .upsert(
        { user_id: user.id, month: monthKey(month), limit_cents: cents },
        { onConflict: 'user_id,month' },
      )
    if (error) return { status: 'error', message: "Le plafond n'a pas pu être enregistré." }
  }

  revalidatePath('/', 'layout')
  return { status: 'idle', message: '' }
}
