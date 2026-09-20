'use server'

import { revalidatePath } from 'next/cache'

import { parseIsoDay } from '@/lib/dates'
import { parseCents } from '@/lib/money'
import { currentSpace, requireBudget, requireUser } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { EspaceState } from './state'

/** Crée un objectif. Partagé seulement si on le demande et qu'on a un espace. */
export async function addGoal(
  _prev: EspaceState,
  formData: FormData,
): Promise<EspaceState> {
  await requireBudget()
  const user = await requireUser()

  const label = String(formData.get('label') ?? '').trim().slice(0, 60)
  const target = parseCents(String(formData.get('target') ?? ''))
  const saved = parseCents(String(formData.get('saved') ?? '0')) ?? 0
  const on = String(formData.get('target_on') ?? '')
  const shared = formData.get('shared') === 'on'
  const hold = formData.get('hold') === 'on'

  if (!label) return { status: 'error', message: "Donne un nom à cet objectif." }
  if (target === null || target <= 0) {
    return { status: 'error', message: 'Entre un montant à atteindre.' }
  }
  if (!parseIsoDay(on)) {
    return { status: 'error', message: "Choisis une date d'échéance." }
  }
  if (saved > target) {
    return { status: 'error', message: "Tu as déjà dépassé cet objectif : vise plus haut." }
  }

  // Partager exige un espace. Sans espace, l'objectif reste personnel
  // plutôt que d'échouer : c'est le cas de quelqu'un qui n'a que le budget.
  const space = shared ? await currentSpace() : null

  const supabase = await createClient()
  const { error } = await supabase.from('savings_goals').insert({
    user_id: user.id,
    group_id: space?.group.id ?? null,
    label,
    target_cents: target,
    saved_cents: saved,
    target_on: on,
    hold_in_budget: hold,
  })

  if (error) {
    return {
      status: 'error',
      message: missingTable(error.code)
        ? "La table des objectifs n'existe pas encore : exécute migrations/005-objectifs.sql."
        : "L'objectif n'a pas pu être créé.",
    }
  }

  revalidatePath('/', 'layout')
  return { status: 'ok', message: 'Objectif créé.' }
}

/**
 * Met à jour ce qu'on a déjà de côté.
 *
 * C'est le seul geste régulier que demande un objectif : on recopie le
 * solde de son livret. Tenir un registre de versements serait plus
 * précis sur le papier et abandonné au bout de trois semaines.
 */
export async function setSaved(
  _prev: EspaceState,
  formData: FormData,
): Promise<EspaceState> {
  await requireBudget()

  const id = String(formData.get('id') ?? '')
  const saved = parseCents(String(formData.get('saved') ?? ''))
  if (!id) return { status: 'error', message: 'Objectif introuvable.' }
  if (saved === null || saved < 0) {
    return { status: 'error', message: 'Entre un montant valide.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('savings_goals')
    .update({ saved_cents: saved })
    .eq('id', id)

  if (error) return { status: 'error', message: "La mise à jour a échoué." }

  revalidatePath('/', 'layout')
  return { status: 'ok', message: 'Montant mis à jour.' }
}

/** Bascule la ponction sur le reste à vivre. */
export async function toggleHold(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const hold = formData.get('hold') === 'on'

  const supabase = await createClient()
  await supabase.from('savings_goals').update({ hold_in_budget: hold }).eq('id', id)
  revalidatePath('/', 'layout')
}

/** Supprime — la policy réserve le geste au créateur. */
export async function removeGoal(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  await supabase.from('savings_goals').delete().eq('id', id)
  revalidatePath('/', 'layout')
}

/** La migration 005 n'a pas été exécutée. */
function missingTable(code: string | undefined): boolean {
  return code === 'PGRST205' || code === '42P01'
}
