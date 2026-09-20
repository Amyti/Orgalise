'use client'

import { useActionState, useState } from 'react'

import { addEntry, addGoal, setSaved } from '@/lib/actions/goals'
import { initialEspaceState } from '@/lib/actions/state'
import styles from './objectifs.module.css'

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

/**
 * Mise à jour de ce qu'on a déjà de côté.
 *
 * Le seul geste régulier qu'un objectif demande : recopier le solde de
 * son livret. Un registre de versements serait plus précis sur le papier,
 * et abandonné au bout de trois semaines.
 */
export function SavedForm({ id, current }: { id: string; current: number }) {
  const [state, action, pending] = useActionState(setSaved, initialEspaceState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>
        Mettre à jour le montant
      </button>
    )
  }

  return (
    <form action={action} className={styles.inline}>
      <input type="hidden" name="id" value={id} />
      <label className="srOnly" htmlFor={`saved-${id}`}>
        Montant déjà de côté
      </label>
      <input
        id={`saved-${id}`}
        name="saved"
        type="text"
        inputMode="decimal"
        className={styles.input}
        defaultValue={(current / 100).toFixed(2).replace('.', ',')}
        disabled={pending}
      />
      <button type="submit" className={styles.smallButton} disabled={pending}>
        {pending ? '…' : 'Enregistrer'}
      </button>
      <Feedback state={state} />
    </form>
  )
}

/**
 * Un versement ponctuel : prime, cadeau, remboursement.
 *
 * La case « pris sur mon budget du mois » est décochée par défaut,
 * parce que le cas qui motive ce formulaire est l'argent venu
 * d'ailleurs. Une prime n'a jamais transité par l'enveloppe, elle n'a
 * donc pas à en sortir — la cocher à tort ferait plonger le reste à
 * vivre un mois où l'on a, au contraire, reçu de l'argent.
 */
export function EntryForm({ goalId }: { goalId: string }) {
  const [state, action, pending] = useActionState(addEntry, initialEspaceState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>
        Ajouter un versement
      </button>
    )
  }

  return (
    <form action={action} className={styles.entryForm}>
      <input type="hidden" name="goal_id" value={goalId} />

      <label className="srOnly" htmlFor={`entry-label-${goalId}`}>
        Origine du versement
      </label>
      <input
        id={`entry-label-${goalId}`}
        name="label"
        type="text"
        className={styles.input}
        placeholder="Prime, cadeau, remboursement…"
        maxLength={60}
        disabled={pending}
      />

      <div className={styles.pair}>
        <div>
          <label className={styles.fieldLabel} htmlFor={`entry-amount-${goalId}`}>
            Montant
          </label>
          <input
            id={`entry-amount-${goalId}`}
            name="amount"
            type="text"
            inputMode="decimal"
            className={styles.input}
            placeholder="0,00"
            required
            disabled={pending}
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor={`entry-date-${goalId}`}>
            Date
          </label>
          <input
            id={`entry-date-${goalId}`}
            name="on_date"
            type="date"
            className={styles.input}
            disabled={pending}
          />
        </div>
      </div>

      <label className={styles.hold}>
        <input type="checkbox" name="from_envelope" className={styles.checkbox} />
        Pris sur mon budget du mois
      </label>

      <Feedback state={state} />

      <div className={styles.inline}>
        <button type="submit" className={styles.smallButton} disabled={pending}>
          {pending ? '…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

/** Création d'un objectif. */
export function AddGoalForm({ canShare }: { canShare: boolean }) {
  const [state, action, pending] = useActionState(addGoal, initialEspaceState)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className={styles.section}>
        <button type="button" className={styles.addButton} onClick={() => setOpen(true)}>
          Nouvel objectif
        </button>
      </div>
    )
  }

  return (
    <form action={action} className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className="sectionTitle">Nouvel objectif</h2>
      </div>

      <div className={styles.fields}>
        <label className="srOnly" htmlFor="goal-label">Nom</label>
        <input
          id="goal-label"
          name="label"
          type="text"
          className={styles.input}
          placeholder="Apport, voyage au Japon…"
          maxLength={60}
          disabled={pending}
          required
        />

        <label className={styles.fieldLabel} htmlFor="goal-target">
          Montant à atteindre
        </label>
        <input
          id="goal-target"
          name="target"
          type="text"
          inputMode="decimal"
          className={styles.input}
          placeholder="10000"
          disabled={pending}
          required
        />

        <label className={styles.fieldLabel} htmlFor="goal-saved">
          Déjà de côté
        </label>
        <input
          id="goal-saved"
          name="saved"
          type="text"
          inputMode="decimal"
          className={styles.input}
          placeholder="0"
          disabled={pending}
        />

        <label className={styles.fieldLabel} htmlFor="goal-on">
          Pour quand
        </label>
        <input
          id="goal-on"
          name="target_on"
          type="date"
          className={styles.input}
          disabled={pending}
          required
        />

        {canShare && (
          <label className={styles.hold}>
            <input type="checkbox" name="shared" className={styles.checkbox} />
            Objectif commun, visible par vous deux
          </label>
        )}

        <label className={styles.hold}>
          <input
            type="checkbox"
            name="hold"
            defaultChecked
            className={styles.checkbox}
          />
          Retirer l'épargne de mon reste à vivre
        </label>
      </div>

      <Feedback state={state} />

      <div className={styles.actions}>
        <button type="submit" className="btnPrimary" disabled={pending}>
          {pending ? 'Création…' : "Créer l'objectif"}
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
