'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { LOGIN_PATH } from '@/lib/config'
import { landingPath, readModules, toColumn } from '@/lib/modules'
import { currentSpace, currentUserId } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { ExpenseState } from './state'

/**
 * Enregistre les outils choisis.
 *
 * Après le choix, on n'envoie vers la création d'un espace que si
 * l'agenda est activé : quelqu'un qui vient pour ses dépenses n'a pas à
 * inviter un partenaire qu'il n'a pas.
 */
export async function chooseModules(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const agenda = formData.get('agenda') === 'on'
  const budget = formData.get('budget') === 'on'

  if (!agenda && !budget) {
    return { status: 'error', message: 'Choisis au moins un outil.' }
  }

  const userId = await currentUserId()
  if (!userId) redirect(LOGIN_PATH)

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ modules: toColumn({ agenda, budget }) })
    .eq('id', userId)

  if (error) {
    const manquante =
      error.code === '42703' || /column .*modules/i.test(error.message ?? '')
    return {
      status: 'error',
      message: manquante
        ? "Le choix des outils n'est pas encore activé sur cet espace."
        : "Le choix n'a pas pu être enregistré.",
    }
  }

  revalidatePath('/', 'layout')

  if (agenda && !(await currentSpace())) redirect('/groupe')
  redirect(landingPath(readModules(toColumn({ agenda, budget }))))
}
