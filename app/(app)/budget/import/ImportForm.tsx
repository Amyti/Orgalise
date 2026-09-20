'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { CheckIcon, PlusIcon, TrashIcon } from '@/components/Icons'
import { analyseScreenshots, importExpenses } from '@/lib/actions/import'
import { initialAnalyseState, initialImportState } from '@/lib/actions/state'
import { monthName, parseIsoDay, shortDate } from '@/lib/dates'
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
 * 1 150 000 px, c'est environ 1 530 jetons par image. Une capture
 * d'iPhone (1290 × 2796) descend à 728 × 1578, où les montants d'un
 * relevé restent nets.
 *
 * Cette valeur était à 640 000 px, pour économiser des jetons. Le calcul
 * était juste et le résultat mauvais : à cette taille le texte d'une
 * appli bancaire fait huit pixels de haut, et la moitié des lignes
 * passait à la trappe. On gagnait 0,2 centime par import et on perdait
 * la moitié des dépenses. Ne pas redescendre.
 */
const MAX_PIXELS = 1_150_000

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

/**
 * Taille maximale d'un envoi vers le serveur, en caractères de data URL.
 *
 * Une fonction serveur refuse les requêtes trop grosses. Au-delà de ce
 * seuil, les pièces sont découpées en plusieurs envois — ce qui ne coûte
 * rien, puisque le serveur fait de toute façon une requête par pièce.
 */
const LOT_MAX_CHARS = 2_800_000

/** Au-delà, l'envoi risque de dépasser la taille d'une requête serveur. */
const MAX_PNG_CHARS = 900_000

/**
 * Réduit une image dans le navigateur, avant tout envoi.
 *
 * En PNG, sans perte. Une capture d'écran est un aplat de couleurs avec
 * du texte fin : le JPEG y produit du halo autour des caractères, et à
 * dix pixels de haut un montant devient illisible. On était en JPEG
 * qualité 0,8, ce qui abîmait précisément ce qu'on demande au modèle de
 * lire.
 *
 * Le coût ne bouge pas : une image est facturée à ses dimensions, jamais
 * à son poids. Seule la taille de l'envoi augmente, d'où le repli.
 */
async function shrink(file: File, beaucoup: boolean): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // À partir d'une certaine quantité, le PNG ferait exploser le nombre
  // d'envois. JPEG 0,92 reste très au-dessus du 0,8 qui brouillait les
  // montants, pour un tiers du poids.
  if (beaucoup) return canvas.toDataURL('image/jpeg', 0.92)

  const png = canvas.toDataURL('image/png')
  return png.length <= MAX_PNG_CHARS ? png : canvas.toDataURL('image/jpeg', 0.95)
}

/**
 * Répartit les pièces en envois qui tiennent dans une requête.
 *
 * Une pièce plus grosse que le seuil part seule : mieux vaut un envoi
 * trop gros qui échoue en le disant qu'une pièce écartée en silence.
 */
function enLots(pieces: Piece[], maxChars: number): Piece[][] {
  const lots: Piece[][] = []
  let lot: Piece[] = []
  let taille = 0

  for (const piece of pieces) {
    const n = piece.url.length
    if (lot.length > 0 && taille + n > maxChars) {
      lots.push(lot)
      lot = []
      taille = 0
    }
    lot.push(piece)
    taille += n
  }
  if (lot.length > 0) lots.push(lot)
  return lots
}

export function ImportForm({ known, aiReady, maxImages }: {
  known: string[]
  /** Faux quand la clé de lecture manque : seul le collage reste. */
  aiReady: boolean
  maxImages: number
}) {
  const [saved, importAction, saving] = useActionState(importExpenses, initialImportState)

  /*
   * L'analyse n'est plus une action de formulaire mais une boucle : les
   * pièces partent en plusieurs envois quand elles ne tiennent pas dans
   * une requête. C'est ce qui permet d'en accepter onze au lieu de six.
   */
  const [analyse, setAnalyse] = useState(initialAnalyseState)
  const [analysing, setAnalysing] = useState(false)
  const [progres, setProgres] = useState('')

  const [shots, setShots] = useState<Piece[]>([])
  const [preparing, setPreparing] = useState(false)
  const [tooBig, setTooBig] = useState(false)
  const [tropDe, setTropDe] = useState(0)
  const [raw, setRaw] = useState('')
  const [manual, setManual] = useState(!aiReady)
  const [copied, setCopied] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Ce que le modèle a lu rejoint l'aperçu, exactement comme un collage.
  useEffect(() => {
    if (analyse.status === 'ok' && analyse.json) setRaw(analyse.json)
  }, [analyse])

  async function lire() {
    const lots = enLots(shots, LOT_MAX_CHARS)
    setAnalysing(true)
    setAnalyse(initialAnalyseState)
    setProgres('')

    const lignes: unknown[] = []
    const echecs: string[] = []

    try {
      for (let i = 0; i < lots.length; i++) {
        if (lots.length > 1) setProgres(`Lot ${i + 1} sur ${lots.length}…`)

        const formData = new FormData()
        for (const piece of lots[i]) formData.append('shot', piece.url)

        const resultat = await analyseScreenshots(initialAnalyseState, formData)
        if (resultat.status === 'ok' && resultat.json) {
          try {
            const lues = JSON.parse(resultat.json)
            if (Array.isArray(lues)) lignes.push(...lues)
          } catch {
            // Un lot illisible ne doit pas emporter les autres.
            echecs.push(resultat.message)
          }
        } else {
          echecs.push(resultat.message)
        }
      }
    } finally {
      setAnalysing(false)
      setProgres('')
    }

    if (lignes.length === 0) {
      setAnalyse({
        status: 'error',
        message: echecs[0] ?? "Aucune dépense n'a pu être lue.",
        json: '',
      })
      return
    }

    setAnalyse({
      status: 'ok',
      message: echecs.length > 0 ? `Lecture partielle : ${echecs.length} lot en échec.` : '',
      json: JSON.stringify(lignes),
    })
  }

  const prompt = useMemo(() => promptFor(known), [known])
  const parsed = useMemo(() => parseExpenseJson(raw, known), [raw, known])
  const total = totalCents(parsed.rows)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const choisis = Array.from(e.target.files ?? [])
    const place = maxImages - shots.length
    // Rogner en silence est ce qui a fait croire pendant des jours que le
    // modèle lisait mal : il manquait simplement la moitié des captures.
    if (choisis.length > place) setTropDe(choisis.length - place)
    const files = choisis.slice(0, place)
    if (files.length === 0) return
    setPreparing(true)
    setTooBig(false)
    setTropDe(0)
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
          next.push({
            kind: 'image',
            url: await shrink(file, shots.length + files.length > 4),
            name: file.name,
          })
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
    /*
     * Un relevé couvre souvent le mois passé. Renvoyer vers le mois en
     * cours montrait un écran vide, et l'import réussi avait l'air
     * d'avoir échoué. On nomme donc les mois touchés, et le lien mène au
     * premier d'entre eux.
     */
    const noms = saved.months
      .map((m) => parseIsoDay(`${m}-01`))
      .filter((d): d is Date => d !== null)
      .map((d) => monthName(d))
    const cible = saved.months[0] ? `?mois=${saved.months[0]}-01` : ''

    return (
      <section className={styles.section}>
        <div className={styles.done}>
          <div className={styles.doneBadge}>
            <CheckIcon size={22} color="var(--on-strong)" width={2.4} />
          </div>
          <div>
            <p className={styles.doneText}>{saved.message}</p>
            {noms.length > 0 && (
              <p className={styles.doneWhere}>
                {noms.length === 1 ? 'Sur ' : 'Réparties sur '}
                {noms.join(', ')}.
              </p>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <Link href={`/budget/tableau${cible}`} className="btnPrimary">
            {noms.length === 1 ? `Voir ${noms[0]}` : 'Voir mes dépenses'}
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
        <div className={styles.section}>
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

          {tropDe > 0 && (
            <div className="errorBox" role="alert">
              {tropDe} pièce{tropDe > 1 ? 's' : ''} n'{tropDe > 1 ? 'ont' : 'a'} pas
              été retenue{tropDe > 1 ? 's' : ''} : le maximum est de {maxImages}.
            </div>
          )}

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
              <button
                type="button"
                className="btnPrimary"
                onClick={lire}
                disabled={busy}
              >
                {analysing ? progres || 'Lecture en cours…' : 'Lire mes dépenses'}
              </button>
            </div>
          )}
        </div>
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
