'use client'

import { useActionState } from 'react'

import { chooseModules } from '@/lib/actions/modules'
import { initialExpenseState } from '@/lib/actions/state'
import type { Modules } from '@/lib/modules'
import styles from './espace.module.css'

const LIBELLES = {
  agenda: "L'agenda à deux",
  budget: 'Le suivi de mes dépenses',
} as const

/**
 * Activer ou retirer un outil après coup.
 *
 * Activer l'agenda sans espace envoie vers la création d'un — c'est
 * `chooseModules` qui s'en charge, pour que le geste soit le même qu'à
 * l'inscription.
 */
export function ModulesForm({ current }: { current: Modules }) {
  const [state, action, pending] = useActionState(chooseModules, initialExpenseState)

  return (
    <form action={action}>
      <div className="list">
        {(['agenda', 'budget'] as const).map((key) => (
          <label key={key} className={styles.row}>
            <input
              type="checkbox"
              name={key}
              className={styles.check}
              defaultChecked={current[key]}
              disabled={pending}
            />
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{LIBELLES[key]}</span>
            </span>
          </label>
        ))}
      </div>

      {state.status === 'error' && (
        <div className="errorBox" role="alert" style={{ marginTop: 9 }}>
          {state.message}
        </div>
      )}

      <button
        type="submit"
        className={styles.smallButton}
        style={{ marginTop: 10 }}
        disabled={pending}
      >
        {pending ? '…' : 'Enregistrer'}
      </button>
    </form>
  )
}
