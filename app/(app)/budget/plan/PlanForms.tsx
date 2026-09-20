'use client'

import { useActionState, useState } from 'react'

import { PlusIcon } from '@/components/Icons'
import { saveFixedCharge, saveIncome, savePlanned, saveSavingsPlan } from '@/lib/actions/plan'
import { initialExpenseState } from '@/lib/actions/state'
import type { Goal } from '@/lib/goals'
import type { Category } from '@/lib/types'
import styles from './plan.module.css'

type Kind = 'income' | 'fixed' | 'planned' | 'savings'

const WORDING: Record<Kind, { add: string; name: string; placeholder: string }> = {
  income: { add: 'Ajouter un revenu', name: 'Intitulé', placeholder: 'Salaire' },
  fixed: { add: 'Ajouter une charge fixe', name: 'Intitulé', placeholder: 'Loyer' },
  planned: { add: 'Ajouter une dépense prévue', name: 'Intitulé', placeholder: 'Impôts' },
  savings: { add: 'Ajouter un virement d’épargne', name: 'Intitulé', placeholder: 'Virement livret' },
}

/**
 * Un seul formulaire pour les trois types : ils ne diffèrent que par le
 * champ de date (jour du mois pour une règle, date pleine pour une
 * ponctuelle) et par la présence d'une catégorie.
 */
export function PlanForm({
  kind,
  categories,
  defaultDue,
  goals = [],
}: {
  kind: Kind
  categories: Category[]
  /** Date par défaut d'une dépense prévue, au format `YYYY-MM-DD`. */
  defaultDue?: string
  /** Objectifs proposés au fléchage, pour l'épargne uniquement. */
  goals?: Goal[]
}) {
  const action =
    kind === 'income'
      ? saveIncome
      : kind === 'fixed'
        ? saveFixedCharge
        : kind === 'savings'
          ? saveSavingsPlan
          : savePlanned
  const [state, submit, pending] = useActionState(action, initialExpenseState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={styles.addToggle} onClick={() => setOpen(true)}>
        <PlusIcon size={16} color="var(--ink-soft)" width={2.2} />
        {WORDING[kind].add}
      </button>
    )
  }

  return (
    <form
      action={(formData) => {
        submit(formData)
        setOpen(false)
      }}
      className={styles.form}
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${kind}-label`}>
          {WORDING[kind].name}
        </label>
        <input
          id={`${kind}-label`}
          name="label"
          type="text"
          className={styles.input}
          placeholder={WORDING[kind].placeholder}
          maxLength={60}
          autoFocus
          required
          disabled={pending}
        />
      </div>

      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${kind}-amount`}>
            Montant
          </label>
          <input
            id={`${kind}-amount`}
            name="amount"
            type="text"
            inputMode="decimal"
            className={styles.input}
            placeholder="0,00"
            required
            disabled={pending}
          />
        </div>

        {kind === 'planned' ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="planned-due">
              Échéance
            </label>
            <input
              id="planned-due"
              name="due_on"
              type="date"
              className={styles.input}
              defaultValue={defaultDue}
              required
              disabled={pending}
            />
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${kind}-day`}>
              Jour du mois
            </label>
            <input
              id={`${kind}-day`}
              name="day_of_month"
              type="number"
              min={1}
              max={31}
              defaultValue={kind === 'income' ? 1 : kind === 'savings' ? 2 : 5}
              className={styles.input}
              disabled={pending}
            />
          </div>
        )}
      </div>

      {kind === 'savings' && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="savings-goal">
            Pour quel objectif&nbsp;?
          </label>
          <select
            id="savings-goal"
            name="goal_id"
            className={styles.select}
            disabled={pending}
          >
            {/* Épargne libre en premier : c'est le cas le plus courant
                quand on n'a pas encore d'objectif. */}
            <option value="">Épargne libre, sans objectif</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {kind !== 'income' && kind !== 'savings' && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${kind}-cat`}>
            Catégorie
          </label>
          <select
            id={`${kind}-cat`}
            name="category_id"
            className={styles.select}
            disabled={pending}
          >
            <option value="">Sans catégorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {state.status === 'error' && (
        <div className="errorBox" role="alert">
          {state.message}
        </div>
      )}

      <div className={styles.formActions}>
        <button type="submit" className={styles.save} disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          className={styles.cancel}
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
