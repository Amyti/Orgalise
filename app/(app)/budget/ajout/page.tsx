import type { Metadata } from 'next'
import Link from 'next/link'

import { CloseIcon } from '@/components/Icons'
import { isoDay, parseIsoDay } from '@/lib/dates'
import { requireSpace } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import { withPaletteColors } from '@/lib/categories'
import type { Category } from '@/lib/types'
import { ExpenseForm } from './ExpenseForm'
import styles from './ajout.module.css'

export const metadata: Metadata = { title: 'Nouvelle dépense' }

export default async function AjoutPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  await requireSpace()
  const { date } = await searchParams

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, color, position')
    .order('position')

  return (
    <div className={`screen ${styles.screen}`}>
      <div className={styles.bar}>
        <Link href="/budget" className="backLink" aria-label="Annuler">
          <CloseIcon size={19} color="var(--ink)" />
        </Link>
        <div className={styles.barTitle}>Nouvelle dépense</div>
        <div className={styles.barSpacer} />
      </div>

      <ExpenseForm
        categories={withPaletteColors((categories ?? []) as Category[])}
        defaultDate={isoDay(parseIsoDay(date) ?? new Date())}
      />
    </div>
  )
}
