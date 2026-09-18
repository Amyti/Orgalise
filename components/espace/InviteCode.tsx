'use client'

import { useState } from 'react'

import { ShareIcon } from '@/components/Icons'
import styles from './espace.module.css'

/**
 * Le code d'invitation, avec un bouton qui passe par le partage natif
 * quand il existe (iOS, Android) et retombe sur le presse-papiers sinon.
 */
export function InviteCode({ code, spaceName }: { code: string; spaceName: string }) {
  const [feedback, setFeedback] = useState('')

  const message = `Rejoins « ${spaceName} » avec le code ${code}.`

  async function send() {
    setFeedback('')
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text: message })
        return
      }
      await navigator.clipboard.writeText(message)
      setFeedback('Copié. Colle-le dans un message.')
    } catch (error) {
      // L'utilisateur a annulé le partage : ce n'est pas une erreur.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setFeedback(`Copie impossible. Le code est ${code}.`)
    }
  }

  return (
    <div className={styles.inviteCard}>
      <div className={styles.inviteLabel}>Code d'invitation</div>

      <div className={styles.codeRow}>
        {code.split('').map((char, i) => (
          <div key={i} className={styles.codeChar}>
            {char}
          </div>
        ))}
      </div>

      <button type="button" className={styles.sendButton} onClick={send}>
        <ShareIcon size={16} color="var(--on-strong)" />
        Envoyer le code
      </button>

      <div className={styles.sendFeedback} aria-live="polite">
        {feedback}
      </div>
    </div>
  )
}
