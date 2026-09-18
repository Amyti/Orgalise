'use client'

import { useActionState, useState } from 'react'

import { chooseModules } from '@/lib/actions/modules'
import { initialExpenseState } from '@/lib/actions/state'
import type { Modules } from '@/lib/modules'
import styles from './demarrer.module.css'

const CHOIX = [
  {
    key: 'agenda' as const,
    name: 'Savoir quand vous êtes libres',
    why: "Vos deux calendriers côte à côte, et les créneaux où personne n'est pris qui ressortent d'eux-mêmes. À deux.",
  },
  {
    key: 'budget' as const,
    name: 'Suivre mes dépenses',
    why: 'Salaire, charges fixes, dépenses du mois — et ce qu’il te reste vraiment à dépenser. Strictement personnel, même à deux.',
  },
]

export function ModuleChoice({ current }: { current: Modules }) {
  const [state, action, pending] = useActionState(chooseModules, initialExpenseState)
  // Par défaut les deux : c'est le produit complet, et rien n'oblige à
  // trancher tout de suite — tout se change ensuite dans les réglages.
  const [on, setOn] = useState({
    agenda: current.chosen ? current.agenda : true,
    budget: current.chosen ? current.budget : true,
  })

  const aucun = !on.agenda && !on.budget

  return (
    <form action={action}>
      <div className={styles.choices}>
        {CHOIX.map(({ key, name, why }) => (
          <label
            key={key}
            className={`${styles.choice} ${on[key] ? styles.choiceOn : ''}`}
          >
            <input
              type="checkbox"
              name={key}
              className="srOnly"
              checked={on[key]}
              onChange={(e) => setOn((v) => ({ ...v, [key]: e.target.checked }))}
              disabled={pending}
            />
            <span className={`${styles.box} ${on[key] ? styles.boxOn : ''}`} aria-hidden="true">
              {on[key] && <span className={styles.tick} />}
            </span>
            <span className={styles.body}>
              <span className={styles.name}>{name}</span>
              <span className={styles.why}>{why}</span>
            </span>
          </label>
        ))}
      </div>

      <div className={styles.spacer} />

      <div className={styles.foot}>
        {(state.status === 'error' || aucun) && (
          <div className="errorBox" role="alert">
            {aucun ? 'Choisis au moins un outil.' : state.message}
          </div>
        )}

        <button type="submit" className="btnPrimary" disabled={pending || aucun}>
          {pending ? 'Un instant…' : 'Continuer'}
        </button>

        <p className={styles.note}>
          Tu pourras en ajouter ou en retirer à tout moment dans les réglages.
        </p>
      </div>
    </form>
  )
}
