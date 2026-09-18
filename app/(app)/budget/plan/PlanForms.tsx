'use client'

import { useActionState, useState } from 'react'

import { PlusIcon } from '@/components/Icons'
import { saveFixedCharge, saveIncome, savePlanned } from '@/lib/actions/plan'
import { initialExpenseState } from '@/lib/actions/state'
import type { Category } from '@/lib/types'
import styles from './plan.module.css'

type Kind = 'income' | 'fixed' | 'planned'

const WORDING: Record<Kind, { add: string; name: string; placeholder: string }> = {
  income: { add: 'Ajouter un revenu', name: 'Intitulé', placeholder: 'Salaire' },
  fixed: { add: 'Ajouter une charge fixe', name: 'Intitulé', placeholder: 'Loyer' },
  planned: { add: 'Ajouter une dépense prévue', name: 'Intitulé', placeholder: 'Impôts' },
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
}: {
  kind: Kind
  categories: Category[]
  /** Date par défaut d'une dépense prévue, au format `YYYY-MM-DD`. */
  defaultDue?: string
}) {
  const action =
    kind === 'income' ? saveIncome : kind === 'fixed' ? saveFixedCharge : savePlanned
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
              defaultValue={kind === 'income' ? 1 : 5}
              className={styles.input}
              disabled={pending}
            />
          </div>
        )}
      </div>

      {kind !== 'income' && (
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
