'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { CalendarIcon, HomeIcon, PeopleIcon, WalletIcon } from './Icons'
import styles from './chrome.module.css'

/**
 * Navigation basse, quatre entrées.
 *
 * CLAUDE.md notait que les trois écrans calendrier étaient restés sur une
 * ancienne barre à trois items ; tout passe ici par la même barre.
 */
const ITEMS = [
  { href: '/accueil', label: 'Accueil', Icon: HomeIcon },
  { href: '/agenda', label: 'Agenda', Icon: CalendarIcon },
  { href: '/budget', label: 'Budget', Icon: WalletIcon },
  { href: '/nous', label: 'Nous', Icon: PeopleIcon },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon color={active ? 'var(--ink)' : 'var(--ink-soft)'} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
