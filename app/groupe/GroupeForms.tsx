'use client'

import { useActionState, useState } from 'react'

import { LockIcon, PlusIcon } from '@/components/Icons'
import { createSpace, joinSpace } from './actions'
import { CODE_LENGTH, initialGroupState, normaliseCode } from './state'
import styles from './groupe.module.css'

export function GroupeForms() {
  const [createState, createAction, creating] = useActionState(
    createSpace,
    initialGroupState,
  )
  const [joinState, joinAction, joining] = useActionState(
    joinSpace,
    initialGroupState,
  )

  const [name, setName] = useState('Nous deux')
  const [code, setCode] = useState('')

  const busy = creating || joining

  return (
    <>
      <form action={createAction} className={styles.createCard}>
        <div>
          <div className={styles.createHead}>
            <div className={styles.createBadge}>
              <PlusIcon size={16} color="var(--honey-ink)" width={2.3} />
            </div>
            <h2 className={styles.createTitle}>Créer l'espace</h2>
          </div>
          <p className={styles.createHint}>
            Tu le crées, tu reçois un code, tu l'envoies. L'autre rejoint en
            dix secondes.
          </p>
        </div>

        <div className={styles.darkField}>
          <label className={styles.darkLabel} htmlFor="nom">
            Nom de l'espace
          </label>
          <input
            id="nom"
            name="name"
            type="text"
            maxLength={40}
            className={styles.darkInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>

        {createState.status === 'error' && (
          <div className="errorBox" role="alert">
            {createState.message}
          </div>
        )}

        <button type="submit" className={styles.honeyButton} disabled={busy}>
          {creating ? 'Création…' : 'Créer et inviter'}
        </button>
      </form>

      <div className={styles.divider} aria-hidden="true">
        <div className={styles.line} />
        <div className={styles.or}>ou</div>
        <div className={styles.line} />
      </div>

      <form action={joinAction} className={styles.joinCard}>
        <div>
          <h2 className={styles.joinTitle}>J'ai reçu un code</h2>
          <p className={styles.joinHint}>
            Six caractères, envoyés par la personne qui a créé l'espace.
          </p>
        </div>

        <CodeField value={code} onChange={setCode} disabled={busy} />

        {joinState.status === 'error' && (
          <div className="errorBox" role="alert">
            {joinState.message}
          </div>
        )}

        <button
          type="submit"
          className={styles.outlineButton}
          disabled={busy || code.length !== CODE_LENGTH}
        >
          {joining ? 'On rejoint…' : 'Rejoindre'}
        </button>
      </form>

      <div className={styles.spacer} />

      <div className={styles.foot}>
        <LockIcon size={15} color="var(--ink-soft)" />
        <span>
          Un espace ne se rejoint que sur invitation, et n'accueille que deux
          personnes.
        </span>
      </div>
    </>
  )
}

/**
 * Six cases dessinées, un seul vrai champ par-dessus. Six `<input>`
 * séparés obligeraient à gérer le focus à la main et casseraient le
 * collage du code depuis un SMS.
 */
function CodeField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const slots = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '')

  return (
    <div className={styles.codeWrap}>
      <div className={styles.codeBoxes} aria-hidden="true">
        {slots.map((char, i) => {
          const active = i === value.length && !disabled
          return (
            <div
              key={i}
              className={[
                styles.codeBox,
                char ? styles.codeBoxFilled : '',
                active ? styles.codeBoxActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {char || (active ? <span className={styles.caret} /> : null)}
            </div>
          )
        })}
      </div>
      <label className="srOnly" htmlFor="code">
        Code d'invitation, {CODE_LENGTH} caractères
      </label>
      <input
        id="code"
        name="code"
        type="text"
        inputMode="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={CODE_LENGTH}
        className={styles.codeInput}
        value={value}
        onChange={(e) => onChange(normaliseCode(e.target.value))}
        disabled={disabled}
      />
    </div>
  )
}
