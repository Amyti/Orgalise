'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'

import { CheckIcon } from '@/components/Icons'
import { importExpenses } from '@/lib/actions/import'
import { initialImportState } from '@/lib/actions/state'
import { parseIsoDay, shortDate } from '@/lib/dates'
import { parseExpenseJson, promptFor, totalCents } from '@/lib/import'
import { euros } from '@/lib/money'
import styles from './import.module.css'

/** Au-delà, la liste ne sert plus à vérifier, elle sert à faire défiler. */
const PREVIEW = 6

export function ImportForm({ known }: { known: string[] }) {
  const [state, action, pending] = useActionState(importExpenses, initialImportState)
  const [raw, setRaw] = useState('')
  const [copied, setCopied] = useState(false)

  const prompt = useMemo(() => promptFor(known), [known])

  // Même lecture que le serveur, ici pour montrer avant d'écrire.
  const parsed = useMemo(() => parseExpenseJson(raw, known), [raw, known])
  const total = totalCents(parsed.rows)

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papiers refusé : le texte reste sélectionnable à la main.
    }
  }

  if (state.status === 'ok') {
    return (
      <section className={styles.section}>
        <div className={styles.done}>
          <div className={styles.doneBadge}>
            <CheckIcon size={22} color="var(--on-strong)" width={2.4} />
          </div>
          <p className={styles.doneText}>{state.message}</p>
        </div>

        <div className={styles.actions}>
          <Link href="/budget/tableau" className="btnPrimary">
            Voir mes dépenses
          </Link>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              setRaw('')
              // Le formulaire repart d'un état neuf au prochain rendu.
              window.location.reload()
            }}
          >
            Importer autre chose
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">1 · L'invite à donner à l'IA</h2>
        </div>

        <p className={styles.help}>
          Copie ce texte, envoie-le à ton IA avec tes captures d'écran.
        </p>

        <pre className={styles.prompt}>{prompt}</pre>

        <button type="button" className={styles.ghost} onClick={copy}>
          {copied ? 'Copié' : "Copier l'invite"}
        </button>
      </section>

      <form action={action} className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">2 · Sa réponse</h2>
        </div>

        <label className="srOnly" htmlFor="json">
          JSON des dépenses
        </label>
        <textarea
          id="json"
          name="json"
          className={styles.textarea}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'[\n  {"date": "2026-09-14", "libelle": "Carrefour", "montant": 42.90, "categorie": "Courses"}\n]'}
          spellCheck={false}
          autoCapitalize="none"
          rows={7}
          disabled={pending}
        />

        {parsed.error && raw.trim() !== '' && (
          <div className="errorBox" role="alert">
            {parsed.error}
          </div>
        )}

        {parsed.rows.length > 0 && (
          <>
            <div className={styles.sectionHead} style={{ marginTop: 18 }}>
              <h2 className="sectionTitle">
                {parsed.rows.length} dépense{parsed.rows.length > 1 ? 's' : ''}
              </h2>
              <div className={styles.total}>{euros(total)}</div>
            </div>

            <div className="list">
              {parsed.rows.slice(0, PREVIEW).map((row, i) => {
                const day = parseIsoDay(row.spentOn)
                return (
                  <div key={i} className={styles.row}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>{row.label}</div>
                      <div className={styles.rowMeta}>
                        {day ? shortDate(day) : row.spentOn} · {row.categoryName}
                      </div>
                    </div>
                    <div className={styles.rowAmount}>{euros(row.amountCents)}</div>
                  </div>
                )
              })}
            </div>

            {parsed.rows.length > PREVIEW && (
              <p className={styles.help}>
                et {parsed.rows.length - PREVIEW} autre
                {parsed.rows.length - PREVIEW > 1 ? 's' : ''}.
              </p>
            )}
          </>
        )}

        {parsed.rejects.length > 0 && (
          <div className="noticeBox" role="status">
            {parsed.rejects.length} ligne{parsed.rejects.length > 1 ? 's' : ''} sera
            {parsed.rejects.length > 1 ? 'ont' : ''} ignorée
            {parsed.rejects.length > 1 ? 's' : ''} :{' '}
            {parsed.rejects
              .slice(0, 3)
              .map((r) => `n° ${r.index + 1} (${r.reason})`)
              .join(', ')}
            {parsed.rejects.length > 3 ? '…' : ''}
          </div>
        )}

        {state.status === 'error' && (
          <div className="errorBox" role="alert">
            {state.message}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="submit"
            className="btnPrimary"
            disabled={pending || parsed.rows.length === 0}
          >
            {pending
              ? 'Ajout…'
              : parsed.rows.length === 0
                ? 'Ajouter les dépenses'
                : `Ajouter ${parsed.rows.length} dépense${parsed.rows.length > 1 ? 's' : ''}`}
          </button>
          <p className={styles.help}>
            Une dépense déjà enregistrée au même jour, même montant et même
            intitulé ne sera pas ajoutée deux fois.
          </p>
        </div>
      </form>
    </>
  )
}
