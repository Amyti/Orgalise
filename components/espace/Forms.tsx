'use client'

import { useActionState, useState } from 'react'

import { addFeed, renameMe, renameSpace } from '@/lib/actions/espace'
import { initialEspaceState } from '@/lib/actions/state'
import styles from './espace.module.css'

function Feedback({ state }: { state: { status: string; message: string } }) {
  if (state.status === 'idle' || !state.message) return null
  return (
    <div
      className={state.status === 'error' ? 'errorBox' : 'noticeBox'}
      role={state.status === 'error' ? 'alert' : 'status'}
    >
      {state.message}
    </div>
  )
}

/** Branchement d'un calendrier iCal. */
export function FeedForm() {
  const [state, action, pending] = useActionState(addFeed, initialEspaceState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={styles.toggleLink} onClick={() => setOpen(true)}>
        Brancher mon calendrier
      </button>
    )
  }

  return (
    <form action={action} className={styles.form}>
      <label className="srOnly" htmlFor="feed-label">
        Nom du calendrier
      </label>
      <input
        id="feed-label"
        name="label"
        type="text"
        className={styles.input}
        placeholder="Mon calendrier"
        maxLength={40}
        disabled={pending}
      />

      <label className="srOnly" htmlFor="feed-url">
        Adresse iCal secrète
      </label>
      <input
        id="feed-url"
        name="url"
        type="url"
        inputMode="url"
        className={styles.input}
        placeholder="https://calendar.google.com/…/basic.ics"
        autoCapitalize="none"
        spellCheck={false}
        disabled={pending}
        required
      />

      <Feedback state={state} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className={styles.smallButton} disabled={pending}>
          {pending ? 'Synchro…' : 'Brancher'}
        </button>
        <button
          type="button"
          className={styles.toggleLink}
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>

      <p className={styles.hint}>
        Google Agenda → Paramètres du calendrier → « Adresse secrète au format
        iCal ». Apple Calendrier → Partager → Calendrier public.
      </p>
    </form>
  )
}

/** Prénom affiché : c'est lui qui nomme les rubans et les pastilles. */
export function NameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(renameMe, initialEspaceState)

  return (
    <form action={action} className={styles.inlineForm}>
      <label className="srOnly" htmlFor="display-name">
        Ton prénom
      </label>
      <input
        id="display-name"
        name="display_name"
        type="text"
        className={styles.input}
        defaultValue={current}
        maxLength={24}
        disabled={pending}
      />
      <button type="submit" className={styles.smallButton} disabled={pending}>
        {pending ? '…' : 'Changer'}
      </button>
      {state.status === 'error' && (
        <span className="srOnly" role="alert">
          {state.message}
        </span>
      )}
    </form>
  )
}

export function SpaceNameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(renameSpace, initialEspaceState)

  return (
    <>
      <form action={action} className={styles.inlineForm}>
        <label className="srOnly" htmlFor="space-name">
          Nom de l'espace
        </label>
        <input
          id="space-name"
          name="name"
          type="text"
          className={styles.input}
          defaultValue={current}
          maxLength={40}
          disabled={pending}
        />
        <button type="submit" className={styles.smallButton} disabled={pending}>
          {pending ? '…' : 'Changer'}
        </button>
      </form>
      {state.status === 'error' && (
        <div className="errorBox" role="alert" style={{ marginTop: 9 }}>
          {state.message}
        </div>
      )}
    </>
  )
}
