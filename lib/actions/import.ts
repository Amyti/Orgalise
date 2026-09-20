'use server'

import { revalidatePath } from 'next/cache'

import { MAX_IMAGES, readReceipts, type Piece } from '@/lib/ai'
import { parseExpenseJson, promptFor, rowKey } from '@/lib/import'
import { requireBudget, requireUser } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { AnalyseState, ImportState } from './state'

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

  if (error) return { status: 'error', message: error, added: 0, skipped: 0, months: [] }
  if (rows.length === 0) {
    return {
      status: 'error',
      message: "Aucune dépense lisible dans ce JSON.",
      added: 0,
      skipped: 0,
      months: [],
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
      // Le détail part dans les logs : l'écran reste sobre, mais on ne
      // veut pas chercher à l'aveugle si ça se reproduit.
      console.error('[import]', failed.code, failed.message)
      return {
        status: 'error',
        message: "Les dépenses n'ont pas pu être enregistrées.",
        added: 0,
        skipped: 0,
        months: [],
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
    months: [...new Set(fresh.map((f) => f.spent_on.slice(0, 7)))].sort(),
  }
}

/** `data:image/jpeg;base64,AAA…` → les morceaux dont l'API a besoin. */
function readDataUrl(value: string): Piece | null {
  const m = /^data:(image\/(?:jpeg|png|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(value)
  if (!m) return null
  return {
    kind: m[1] === 'application/pdf' ? 'pdf' : 'image',
    mediaType: m[1],
    base64: m[2],
  }
}

/**
 * Fait lire les captures par le modèle et renvoie son JSON.
 *
 * N'écrit rien : la réponse repart vers l'aperçu, et c'est
 * `importExpenses` qui enregistre, après validation humaine. Ce
 * découpage tient à ce qu'un modèle se trompe — sur un montant, sur une
 * date — et qu'une dépense fausse vaut moins qu'une dépense absente.
 */
export async function analyseScreenshots(
  _prev: AnalyseState,
  formData: FormData,
): Promise<AnalyseState> {
  await requireBudget()

  const pieces = formData
    .getAll('shot')
    .map((v) => readDataUrl(String(v)))
    .filter((p): p is Piece => p !== null)
    .slice(0, MAX_IMAGES)

  if (pieces.length === 0) {
    return { status: 'error', message: 'Choisis au moins une capture ou un relevé.', json: '' }
  }

  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('name')
  const known = (categories ?? []).map((c) => c.name as string)

  const result = await readReceipts(pieces, promptFor(known))
  if (!result.ok) {
    return { status: 'error', message: result.message, json: '' }
  }

  // On relit tout de suite : mieux vaut « rien de lisible » ici qu'un
  // aperçu vide sans explication.
  const { rows, error } = parseExpenseJson(result.text, known)
  if (error || rows.length === 0) {
    return {
      status: 'error',
      message: "Aucune dépense n'a pu être lue. Vérifie qu'on voit bien les montants et les dates.",
      json: '',
    }
  }

  return {
    status: 'ok',
    message: `${rows.length} dépense${rows.length > 1 ? 's' : ''} lue${rows.length > 1 ? 's' : ''}.`,
    json: result.text,
  }
}
