'use client'

import { useActionState, useState } from 'react'

import { setLimit } from '@/lib/actions/expenses'
import { initialExpenseState } from '@/lib/actions/state'
import styles from './budget.module.css'

/** Plafond du mois : facultatif, modifiable, supprimable en vidant le champ. */
export function LimitForm({
  monthIso,
  current,
}: {
  monthIso: string
  current: string
}) {
  const [state, action, pending] = useActionState(setLimit, initialExpenseState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={styles.limitButton} onClick={() => setOpen(true)}>
        {current ? `Plafond ${current}` : 'Définir un plafond'}
      </button>
    )
  }

  return (
    <form
      action={(formData) => {
        action(formData)
        setOpen(false)
      }}
      className={styles.limitForm}
    >
      <input type="hidden" name="month" value={monthIso} />
      <label className="srOnly" htmlFor="limit">
        Plafond du mois, en euros
      </label>
      <input
        id="limit"
        name="limit"
        type="text"
        inputMode="decimal"
        className={styles.limitInput}
        placeholder="800"
        defaultValue={current.replace(/[^\d,]/g, '')}
        disabled={pending}
        autoFocus
      />
      <button type="submit" className={styles.limitSave} disabled={pending}>
        OK
      </button>
      {state.status === 'error' && (
        <span className="srOnly" role="alert">
          {state.message}
        </span>
      )}
    </form>
  )
}
