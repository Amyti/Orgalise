'use client'

import { useActionState, useState } from 'react'

import { CalendarIcon, CheckIcon } from '@/components/Icons'
import { saveExpense } from '@/lib/actions/expenses'
import { initialExpenseState } from '@/lib/actions/state'
import { dayLabel, parseIsoDay, shortDate } from '@/lib/dates'
import { formatDraft } from '@/lib/money'
import type { Category } from '@/lib/types'
import styles from './ajout.module.css'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '←'] as const

export function ExpenseForm({
  categories,
  defaultDate,
}: {
  categories: Category[]
  defaultDate: string
}) {
  const [state, action, pending] = useActionState(saveExpense, initialExpenseState)

  const [draft, setDraft] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [date, setDate] = useState(defaultDate)

  const now = new Date()
  const chosen = parseIsoDay(date) ?? now
  const label = dayLabel(chosen, now)
  // « Aujourd'hui » seul est ambigu une fois la date changée : on rappelle
  // le quantième, comme sur la maquette.
  const relative = label === "Aujourd'hui" || label === 'Hier' || label === 'Demain'

  /** Pavé maison : un `<input type=number>` laisserait passer « 1e5 ». */
  function press(key: string) {
    setDraft((current) => {
      if (key === '←') return current.slice(0, -1)
      if (key === ',') return current.includes('.') ? current : (current || '0') + '.'
      const [, decimals] = current.split('.')
      if (decimals !== undefined && decimals.length >= 2) return current
      if (current === '0') return key
      if (current.replace('.', '').length >= 8) return current
      return current + key
    })
  }

  return (
    <form action={action}>
      <input type="hidden" name="amount" value={draft} />
      <input type="hidden" name="category_id" value={categoryId} />

      <div className={styles.amountZone}>
        <div className={styles.amount} aria-live="polite">
          {formatDraft(draft)} <span className={styles.currency}>€</span>
        </div>

        <label className={styles.dateChip}>
          <CalendarIcon size={13} color="var(--ink-soft)" width={2} />
          {relative ? `${label}, ${shortDate(chosen)}` : label}
          <span className="srOnly">Date de la dépense</span>
          <input
            type="date"
            name="spent_on"
            className={styles.dateInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={pending}
          />
        </label>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="label">
          Intitulé
        </label>
        <input
          id="label"
          name="label"
          type="text"
          className={styles.input}
          placeholder="Boulangerie"
          maxLength={80}
          disabled={pending}
          required
        />
      </div>

      <div className={styles.field}>
        <div className={styles.label}>Catégorie</div>
        <div className={styles.cats}>
          {categories.map((category) => {
            const on = category.id === categoryId
            return (
              <button
                key={category.id}
                type="button"
                className={`${styles.cat} ${on ? styles.catOn : ''}`}
                onClick={() => setCategoryId(category.id)}
                aria-pressed={on}
                disabled={pending}
              >
                <span className={styles.catChip} style={{ background: category.color }} />
                <span className={`${styles.catLabel} ${on ? styles.catLabelOn : ''}`}>
                  {category.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.spacer} />

      {state.status === 'error' && (
        <div className={`errorBox ${styles.message}`} role="alert">
          {state.message}
        </div>
      )}

      <div className={styles.keys}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.key} ${key === '←' ? styles.keyBack : ''}`}
            onClick={() => press(key)}
            aria-label={key === '←' ? 'Effacer' : key === ',' ? 'Virgule' : key}
            disabled={pending}
          >
            {key}
          </button>
        ))}
      </div>

      <div className={styles.foot}>
        <button
          type="submit"
          className="btnPrimary"
          style={{ height: 56, borderRadius: 28 }}
          disabled={pending || draft === ''}
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
          {!pending && <CheckIcon size={17} color="var(--on-strong)" />}
        </button>
      </div>
    </form>
  )
}
