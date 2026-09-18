'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { Modules } from '@/lib/modules'
import { CalendarIcon, HomeIcon, PeopleIcon, WalletIcon } from './Icons'
import styles from './chrome.module.css'

/**
 * Navigation basse, adaptée aux outils activés.
 *
 * Quelqu'un qui n'utilise que le budget n'a ni accueil ni agenda : lui
 * afficher quatre onglets dont deux inertes serait du bruit. Le dernier
 * onglet s'appelle « Nous » quand il y a un espace partagé à gérer,
 * « Réglages » sinon — même écran, même route.
 */
export function BottomNav({ modules }: { modules: Modules }) {
  const pathname = usePathname()

  const items = [
    ...(modules.agenda
      ? [
          { href: '/accueil', label: 'Accueil', Icon: HomeIcon },
          { href: '/agenda', label: 'Agenda', Icon: CalendarIcon },
        ]
      : []),
    ...(modules.budget
      ? [{ href: '/budget', label: 'Budget', Icon: WalletIcon }]
      : []),
    {
      href: '/nous',
      label: modules.agenda ? 'Nous' : 'Réglages',
      Icon: PeopleIcon,
    },
  ]

  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      {items.map(({ href, label, Icon }) => {
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
