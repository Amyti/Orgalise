import { NextResponse, type NextRequest } from 'next/server'

import { loadMonth } from '@/lib/budget'
import { isoDay, monthName, parseIsoDay, startOfMonth, wall } from '@/lib/dates'
import { currentUser } from '@/lib/space'

/**
 * Export CSV du mois affiché.
 *
 * Séparateur point-virgule et virgule décimale : c'est ce qu'attend Excel
 * en locale française, un fichier à virgules s'y ouvre sur une seule colonne.
 * BOM UTF-8 en tête, sinon les accents sortent en mojibake.
 */
export async function GET(request: NextRequest) {
  const user = await currentUser()
  if (!user) return new NextResponse('Non connecté.', { status: 401 })

  const month = startOfMonth(
    parseIsoDay(request.nextUrl.searchParams.get('mois')) ?? new Date(),
  )
  const budget = await loadMonth(month)

  const lines = [['Date', 'Intitulé', 'Catégorie', 'Montant'].join(';')]

  for (const expense of budget.expenses) {
    const category = expense.category_id
      ? budget.byId.get(expense.category_id)?.name
      : undefined
    lines.push(
      [
        expense.spent_on,
        escape(expense.label),
        escape(category ?? 'Sans catégorie'),
        (expense.amount_cents / 100).toFixed(2).replace('.', ','),
      ].join(';'),
    )
  }

  lines.push(['', '', 'Total', (budget.totalCents / 100).toFixed(2).replace('.', ',')].join(';'))

  const w = wall(month)
  const filename = `depenses-${w.year}-${String(w.month).padStart(2, '0')}.csv`

  return new NextResponse(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Guillemets doublés, champ encadré dès qu'il contient un séparateur. */
function escape(value: string): string {
  const needsQuotes = /[";\r\n]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

export const dynamic = 'force-dynamic'
