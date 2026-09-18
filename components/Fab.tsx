import Link from 'next/link'

import { PlusIcon } from './Icons'
import styles from './chrome.module.css'

/** Bouton flottant « + ». La seule ombre portée de l'app. */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <div className={styles.fabLayer}>
      <Link href={href} className={styles.fab} aria-label={label}>
        <PlusIcon size={24} color="var(--on-strong)" width={2.2} />
      </Link>
    </div>
  )
}

export function NavSpacer() {
  return <div className={styles.navSpacer} aria-hidden="true" />
}
