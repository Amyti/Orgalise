'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { CheckIcon, PlusIcon, TrashIcon } from '@/components/Icons'
import { analyseScreenshots, importExpenses } from '@/lib/actions/import'
import { initialAnalyseState, initialImportState } from '@/lib/actions/state'
import { parseIsoDay, shortDate } from '@/lib/dates'
import { parseExpenseJson, promptFor, totalCents } from '@/lib/import'
import { euros } from '@/lib/money'
import styles from './import.module.css'

/** Au-delà, la liste ne sert plus à vérifier, elle sert à faire défiler. */
const PREVIEW = 6

/**
 * Surface visée pour une image envoyée au modèle, en pixels.
 *
 * Une image est facturée à peu près `surface / 750` jetons : c'est la
 * surface qui compte, pas le côté le plus long. Plafonner celle-ci donne
 * donc un coût stable quelle que soit la forme de la capture — portrait
 * d'iPhone ou fenêtre d'ordinateur.
 *
 * 640 000 px, c'est environ 850 jetons par image. Une capture d'iPhone
 * (1290 × 2796) descend à 545 × 1180, où le texte d'un relevé reste net.
 * Si des montants étaient mal lus, c'est le premier chiffre à remonter :
 * doubler cette valeur double le coût d'entrée, qui reste la moitié la
 * moins chère de la facture.
 */
const MAX_PIXELS = 640_000

/** Taille maximale d'un relevé PDF. Un relevé mensuel pèse quelques centaines de ko. */
const MAX_PDF_BYTES = 5_000_000

/** Un fichier choisi, prêt à partir. */
type Piece = { kind: 'image' | 'pdf'; url: string; name: string }

/** Lit un fichier tel quel, sans retouche — cas du PDF. */
function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Réduit et recompresse une image dans le navigateur, avant tout envoi. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

export function ImportForm({ known, aiReady, maxImages }: {
  known: string[]
  /** Faux quand la clé de lecture manque : seul le collage reste. */
  aiReady: boolean
  maxImages: number
}) {
  const [analyse, analyseAction, analysing] = useActionState(analyseScreenshots, initialAnalyseState)
  const [saved, importAction, saving] = useActionState(importExpenses, initialImportState)

  const [shots, setShots] = useState<Piece[]>([])
  const [preparing, setPreparing] = useState(false)
  const [tooBig, setTooBig] = useState(false)
  const [raw, setRaw] = useState('')
  const [manual, setManual] = useState(!aiReady)
  const [copied, setCopied] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Ce que le modèle a lu rejoint l'aperçu, exactement comme un collage.
  useEffect(() => {
    if (analyse.status === 'ok' && analyse.json) setRaw(analyse.json)
  }, [analyse])

  const prompt = useMemo(() => promptFor(known), [known])
  const parsed = useMemo(() => parseExpenseJson(raw, known), [raw, known])
  const total = totalCents(parsed.rows)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, maxImages - shots.length)
    if (files.length === 0) return
    setPreparing(true)
    setTooBig(false)
    try {
      const next: Piece[] = []
      for (const file of files) {
        if (file.type === 'application/pdf') {
          // Un PDF part tel quel : le réduire n'aurait aucun sens, et
          // l'API le lit page par page.
          if (file.size > MAX_PDF_BYTES) {
            setTooBig(true)
            continue
          }
          next.push({ kind: 'pdf', url: await asDataUrl(file), name: file.name })
        } else {
          next.push({ kind: 'image', url: await shrink(file), name: file.name })
        }
      }
      setShots((current) => [...current, ...next].slice(0, maxImages))
    } catch {
      // Un format que le navigateur ne sait pas décoder : on l'ignore.
    } finally {
      setPreparing(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papiers refusé : le texte reste sélectionnable.
    }
  }

  /* --- Après l'enregistrement ---------------------------------------- */
  if (saved.status === 'ok') {
    return (
      <section className={styles.section}>
        <div className={styles.done}>
          <div className={styles.doneBadge}>
            <CheckIcon size={22} color="var(--on-strong)" width={2.4} />
          </div>
          <p className={styles.doneText}>{saved.message}</p>
        </div>
        <div className={styles.actions}>
          <Link href="/budget/tableau" className="btnPrimary">
            Voir mes dépenses
          </Link>
          <button type="button" className={styles.ghost} onClick={() => window.location.reload()}>
            Importer autre chose
          </button>
        </div>
      </section>
    )
  }

  const busy = analysing || saving || preparing

  return (
    <>
      {/* --- 1. Les captures ---------------------------------------- */}
      {aiReady && !manual && (
        <form action={analyseAction} className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className="sectionTitle">Ton relevé</h2>
            {shots.length > 0 && (
              <div className={styles.count}>
                {shots.length} / {maxImages}
              </div>
            )}
          </div>

          {shots.length > 0 && (
            <div className={styles.shots}>
              {shots.map((piece, i) => (
                <div key={i} className={styles.shot}>
                  {piece.kind === 'pdf' ? (
                    <div className={styles.pdf}>
                      <span className={styles.pdfTag}>PDF</span>
                      <span className={styles.pdfName}>{piece.name}</span>
                    </div>
                  ) : (
                    <>
                      {/* Vignette locale, jamais servie par le réseau. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={piece.url} alt={`Capture ${i + 1}`} className={styles.shotImg} />
                    </>
                  )}
                  <input type="hidden" name="shot" value={piece.url} />
                  <button
                    type="button"
                    className={styles.shotRemove}
                    aria-label={`Retirer ${piece.name}`}
                    onClick={() => setShots((c) => c.filter((_, j) => j !== i))}
                    disabled={busy}
                  >
                    <TrashIcon size={14} color="var(--on-strong)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {shots.length < maxImages && (
            <>
              <input
                ref={fileInput}
                id="shots"
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="srOnly"
                onChange={onPick}
                disabled={busy}
              />
              <label htmlFor="shots" className={styles.picker}>
                <PlusIcon size={17} color="var(--ink)" width={2} />
                {preparing
                  ? 'Préparation…'
                  : shots.length === 0
                    ? 'Choisir mon relevé ou mes captures'
                    : 'En ajouter'}
              </label>
            </>
          )}

          <p className={styles.help}>
            Le mieux : le relevé mensuel en PDF, que la plupart des applis
            bancaires savent exporter. Il couvre tout le mois d'un coup, sans
            trou, et coûte moins cher à lire que des captures. Sinon, des
            captures où l'on voit les montants et les dates. Les images sont
            réduites sur ton téléphone avant l'envoi ; rien n'est conservé.
          </p>

          {tooBig && (
            <div className="noticeBox" role="status">
              Un fichier dépassait 5 Mo et a été écarté. Un relevé mensuel
              pèse normalement bien moins.
            </div>
          )}

          {analyse.status === 'error' && (
            <div className="errorBox" role="alert">
              {analyse.message}
            </div>
          )}

          {shots.length > 0 && parsed.rows.length === 0 && (
            <div className={styles.actions}>
              <button type="submit" className="btnPrimary" disabled={busy}>
                {analysing ? 'Lecture en cours…' : 'Lire mes dépenses'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* --- 1 bis. La sortie de secours ---------------------------- */}
      {manual && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className="sectionTitle">L'invite à donner à l'IA</h2>
          </div>
          <p className={styles.help}>
            Copie ce texte, envoie-le à une IA avec tes captures, puis colle sa
            réponse ci-dessous.
          </p>
          <pre className={styles.prompt}>{prompt}</pre>
          <button type="button" className={styles.ghost} onClick={copy}>
            {copied ? 'Copié' : "Copier l'invite"}
          </button>
        </section>
      )}

      {/* --- 2. L'aperçu, puis l'enregistrement --------------------- */}
      <form action={importAction} className={styles.section}>
        <input type="hidden" name="json" value={raw} />

        {manual && (
          <>
            <div className={styles.sectionHead}>
              <h2 className="sectionTitle">Sa réponse</h2>
            </div>
            <label className="srOnly" htmlFor="json-visible">
              JSON des dépenses
            </label>
            <textarea
              id="json-visible"
              className={styles.textarea}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'[\n  {"date": "2026-09-14", "libelle": "Carrefour", "montant": 42.90, "categorie": "Courses"}\n]'}
              spellCheck={false}
              autoCapitalize="none"
              rows={7}
              disabled={busy}
            />
            {parsed.error && raw.trim() !== '' && (
              <div className="errorBox" role="alert">
                {parsed.error}
              </div>
            )}
          </>
        )}

        {parsed.rows.length > 0 && (
          <>
            <div className={styles.sectionHead} style={{ marginTop: manual ? 18 : 0 }}>
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

            {parsed.rejects.length > 0 && (
              <div className="noticeBox" role="status">
                {parsed.rejects.length} ligne{parsed.rejects.length > 1 ? 's' : ''} ignorée
                {parsed.rejects.length > 1 ? 's' : ''} :{' '}
                {parsed.rejects.slice(0, 3).map((r) => `n° ${r.index + 1} (${r.reason})`).join(', ')}
                {parsed.rejects.length > 3 ? '…' : ''}
              </div>
            )}

            {saved.status === 'error' && (
              <div className="errorBox" role="alert">
                {saved.message}
              </div>
            )}

            <div className={styles.actions}>
              <button type="submit" className="btnPrimary" disabled={busy}>
                {saving
                  ? 'Ajout…'
                  : `Ajouter ${parsed.rows.length} dépense${parsed.rows.length > 1 ? 's' : ''}`}
              </button>
              <p className={styles.help}>
                Vérifie les montants avant d'ajouter. Une dépense déjà
                enregistrée au même jour, même montant et même intitulé ne sera
                pas ajoutée deux fois.
              </p>
            </div>
          </>
        )}
      </form>

      {/* --- Bascule entre les deux chemins ------------------------- */}
      {aiReady && parsed.rows.length === 0 && (
        <div className={styles.section}>
          <button
            type="button"
            className={styles.toggle}
            onClick={() => {
              setManual((m) => !m)
              setRaw('')
            }}
          >
            {manual ? 'Revenir aux captures' : 'Coller un JSON à la main'}
          </button>
        </div>
      )}
    </>
  )
}
