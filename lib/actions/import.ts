'use server'

import { revalidatePath } from 'next/cache'

import { parseExpenseJson, rowKey } from '@/lib/import'
import { requireUser } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { ImportState } from './state'

/**
 * Ajoute les dépenses d'un JSON relu par une IA.
 *
 * Le JSON est relu ici avec la même fonction que l'aperçu du
 * navigateur : l'aperçu sert à décider, pas à autoriser. Ce qui arrive
 * dans `formData` reste du texte reçu du client.
 *
 * Deux protections contre le doublon, parce qu'un import se refait
 * volontiers deux fois : les dépenses déjà en base sur la période
 * couverte, et les répétitions à l'intérieur du fichier lui-même.
 */
export async function importExpenses(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser()
  const raw = String(formData.get('json') ?? '')

  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id, name')
  const known = (categories ?? []).map((c) => c.name as string)

  const { rows, rejects, error } = parseExpenseJson(raw, known)

  if (error) return { status: 'error', message: error, added: 0, skipped: 0 }
  if (rows.length === 0) {
    return {
      status: 'error',
      message: "Aucune dépense lisible dans ce JSON.",
      added: 0,
      skipped: 0,
    }
  }

  // Fenêtre exacte des dates importées : inutile de relire toute l'année.
  const days = rows.map((r) => r.spentOn).sort()
  const { data: existing } = await supabase
    .from('expenses')
    .select('spent_on, amount_cents, label')
    .gte('spent_on', days[0])
    .lte('spent_on', days[days.length - 1])

  const seen = new Set(
    (existing ?? []).map((e) =>
      rowKey({
        spentOn: e.spent_on as string,
        amountCents: e.amount_cents as number,
        label: e.label as string,
      }),
    ),
  )

  const byName = new Map((categories ?? []).map((c) => [c.name as string, c.id as string]))

  const fresh = []
  let skipped = 0

  for (const row of rows) {
    const key = rowKey(row)
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    fresh.push({
      user_id: user.id,
      category_id: byName.get(row.categoryName) ?? null,
      amount_cents: row.amountCents,
      label: row.label,
      spent_on: row.spentOn,
    })
  }

  if (fresh.length > 0) {
    const { error: failed } = await supabase.from('expenses').insert(fresh)
    if (failed) {
      return {
        status: 'error',
        message: "Les dépenses n'ont pas pu être enregistrées.",
        added: 0,
        skipped: 0,
      }
    }
  }

  revalidatePath('/', 'layout')

  const parts = [
    fresh.length === 0
      ? 'Aucune nouvelle dépense'
      : `${fresh.length} dépense${fresh.length > 1 ? 's' : ''} ajoutée${fresh.length > 1 ? 's' : ''}`,
  ]
  if (skipped > 0) parts.push(`${skipped} déjà présente${skipped > 1 ? 's' : ''}`)
  if (rejects.length > 0) parts.push(`${rejects.length} ligne${rejects.length > 1 ? 's' : ''} illisible${rejects.length > 1 ? 's' : ''}`)

  return {
    status: 'ok',
    message: `${parts.join(' · ')}.`,
    added: fresh.length,
    skipped,
  }
}
