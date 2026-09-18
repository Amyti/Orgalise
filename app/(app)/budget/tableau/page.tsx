import type { Metadata } from 'next'
import Link from 'next/link'

import { NavSpacer } from '@/components/Fab'
import { ChevronLeftIcon, DownloadIcon } from '@/components/Icons'
import { loadMonth } from '@/lib/budget'
import { isoDay, monthName, parseIsoDay, startOfMonth } from '@/lib/dates'
import { requireSpace } from '@/lib/space'
import { TableauView } from './TableauView'
import styles from './tableau.module.css'

export const metadata: Metadata = { title: 'Toutes les dépenses' }

export default async function TableauPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>
}) {
  await requireSpace()
  const { mois } = await searchParams

  const month = startOfMonth(parseIsoDay(mois) ?? new Date())
  const budget = await loadMonth(month)

  return (
    <div className="screen">
      <div className={styles.bar}>
        <Link href={`/budget?mois=${isoDay(month)}`} className="backLink" aria-label="Retour">
          <ChevronLeftIcon size={19} color="var(--ink)" />
        </Link>
        <a
          className={styles.csv}
          href={`/api/expenses/csv?mois=${isoDay(month)}`}
          download
        >
          <DownloadIcon size={13} color="var(--ink)" />
          CSV
        </a>
      </div>

      <div className={styles.titleZone}>
        <h1 className={`display ${styles.title}`}>Toutes les dépenses</h1>
      </div>

      <TableauView
        expenses={budget.expenses}
        categories={budget.categories}
        monthLabel={monthName(month)}
      />

      <div className={styles.spacer} />
      <NavSpacer />
    </div>
  )
}
