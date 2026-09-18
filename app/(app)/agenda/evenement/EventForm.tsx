'use client'

import { useActionState, useState } from 'react'

import { CheckIcon } from '@/components/Icons'
import { saveEvent } from '@/lib/actions/events'
import { REPEATS, initialEventState } from '@/lib/actions/state'
import { inputValue, isoDay } from '@/lib/dates'
import styles from './evenement.module.css'

export type EventDraft = {
  id?: string
  title: string
  notes: string
  start: string
  end: string
  allDay: boolean
  rrule: string
}

export function EventForm({ draft }: { draft: EventDraft }) {
  const [state, action, pending] = useActionState(saveEvent, initialEventState)
  const [allDay, setAllDay] = useState(draft.allDay)

  const startDate = new Date(draft.start)
  const endDate = new Date(draft.end)

  return (
    <form action={action} className={styles.form}>
      {draft.id && <input type="hidden" name="id" value={draft.id} />}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Quoi
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className={`${styles.input} ${styles.inputTitle}`}
          defaultValue={draft.title}
          placeholder="Dîner dehors"
          maxLength={120}
          autoFocus={!draft.id}
          disabled={pending}
          required
        />
      </div>

      <label className={styles.check}>
        <input
          type="checkbox"
          name="all_day"
          className={styles.checkBox}
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          disabled={pending}
        />
        Toute la journée
      </label>

      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="starts_at">
            Début
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type={allDay ? 'date' : 'datetime-local'}
            className={styles.input}
            defaultValue={allDay ? isoDay(startDate) : inputValue(startDate)}
            key={`start-${allDay}`}
            disabled={pending}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ends_at">
            {allDay ? 'Dernier jour' : 'Fin'}
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type={allDay ? 'date' : 'datetime-local'}
            className={styles.input}
            defaultValue={allDay ? isoDay(endDate) : inputValue(endDate)}
            key={`end-${allDay}`}
            disabled={pending}
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="rrule">
          Répétition
        </label>
        <select
          id="rrule"
          name="rrule"
          className={styles.select}
          defaultValue={draft.rrule}
          disabled={pending}
        >
          {REPEATS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          className={styles.textarea}
          defaultValue={draft.notes}
          maxLength={500}
          disabled={pending}
        />
      </div>

      {state.status === 'error' && (
        <div className="errorBox" role="alert">
          {state.message}
        </div>
      )}

      <div className={styles.spacer} />

      <button type="submit" className="btnPrimary" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
        {!pending && <CheckIcon size={17} color="var(--on-strong)" />}
      </button>
    </form>
  )
}
