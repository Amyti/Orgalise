import Link from 'next/link'

import { isoDay } from '@/lib/dates'
import styles from './agenda.module.css'

/**
 * Jour / Semaine / Mois. La date courante circule d'une vue à l'autre :
 * passer en « Mois » depuis la semaine du 14 doit ouvrir septembre, pas
 * le mois en cours.
 */
export function AgendaTabs({
  active,
  date,
}: {
  active: 'jour' | 'semaine' | 'mois'
  date: Date
}) {
  const day = isoDay(date)

  const tabs = [
    { key: 'jour', label: 'Jour', href: `/agenda/jour?date=${day}` },
    { key: 'semaine', label: 'Semaine', href: `/agenda?semaine=${day}` },
    { key: 'mois', label: 'Mois', href: `/agenda/mois?mois=${day}` },
  ] as const

  return (
    <div className={styles.tabs}>
      {tabs.map((tab) =>
        tab.key === active ? (
          <div
            key={tab.key}
            className={`${styles.tab} ${styles.tabActive}`}
            aria-current="page"
          >
            {tab.label}
          </div>
        ) : (
          <Link key={tab.key} href={tab.href} className={styles.tab}>
            {tab.label}
          </Link>
        ),
      )}
    </div>
  )
}
