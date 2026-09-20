/**
 * Lecture d'un JSON de dépenses produit par une IA à partir de captures
 * d'écran bancaires.
 *
 * Le texte vient d'un modèle de langage, pas d'une API : il est
 * irrégulier par nature. Les clés changent de nom d'une fois sur
 * l'autre, les montants arrivent tantôt en nombre tantôt en chaîne, les
 * dates en français ou en ISO, et le tout est souvent emballé dans un
 * bloc de code Markdown. Plutôt que d'exiger une forme exacte — qu'il
 * faudrait réexpliquer à chaque fois — on accepte largement et on dit
 * précisément ce qui a été refusé.
 *
 * La fonction est pure : le formulaire s'en sert pour l'aperçu, l'action
 * serveur la rejoue avant d'écrire. Ce qui vient du navigateur n'est
 * jamais cru sur parole.
 */
import { isoDay, parseIsoDay } from './dates'
import { parseCents } from './money'

/** Au-delà, c'est un fichier exporté, pas des captures d'écran relues. */
export const MAX_ROWS = 500
const MAX_LABEL = 80

export type ImportRow = {
  label: string
  amountCents: number
  /** Jour ISO, `AAAA-MM-JJ`. */
  spentOn: string
  /** Nom d'une catégorie existante — jamais inventé. */
  categoryName: string
}

/** Une ligne écartée, avec son rang dans le JSON pour qu'on la retrouve. */
export type ImportReject = { index: number; reason: string }

export type ImportResult = {
  rows: ImportRow[]
  rejects: ImportReject[]
  /** Renseigné quand rien n'a pu être lu du tout. */
  error: string | null
}

const EMPTY: ImportResult = { rows: [], rejects: [], error: null }

/** Sans accents ni casse : « Catégorie » et « categorie » sont la même clé. */
function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Un modèle rend souvent son JSON dans un bloc ```json. On l'enlève
 * plutôt que de renvoyer « JSON illisible » sur un contenu valide.
 */
function unwrap(raw: string): string {
  const text = raw.trim()
  const fenced = /^```[a-z]*\s*([\s\S]*?)\s*```$/i.exec(text)
  return (fenced ? fenced[1] : text).trim()
}

/** Premier champ dont le nom figure parmi les alias attendus. */
function field(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const key of Object.keys(row)) {
    if (aliases.includes(plain(key))) return row[key]
  }
  return undefined
}

const LABEL = ['libelle', 'label', 'intitule', 'description', 'marchand', 'commerce', 'nom', 'titre']
const AMOUNT = ['montant', 'amount', 'prix', 'valeur', 'value', 'somme', 'debit']
const DATE = ['date', 'jour', 'spent_on', 'spenton', 'date_operation', 'dateoperation']
const CATEGORY = ['categorie', 'category', 'cat', 'type']

/**
 * Montant en centimes.
 *
 * Un relevé bancaire note les débits en négatif ; on prend la valeur
 * absolue, l'invite demandant par ailleurs d'écarter les crédits. Le
 * passage par `Math.round` évite le 4289,999… de `42.90 * 100`.
 */
function cents(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.round(Math.abs(value) * 100)
  }
  if (typeof value !== 'string') return null
  const parsed = parseCents(value.replace(/^-/, '').trim())
  return parsed === null ? null : Math.abs(parsed)
}

/** Accepte l'ISO, le format français, et l'année sur deux chiffres. */
function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const pad = (n: string) => n.padStart(2, '0')

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text)
  if (!m) {
    const fr = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(text)
    if (fr) {
      const year = fr[3].length === 2 ? `20${fr[3]}` : fr[3]
      m = [text, year, fr[2], fr[1]] as unknown as RegExpExecArray
    }
  }
  if (!m) return null

  const iso = `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  // Un 31 février passerait le format, et `parseIsoDay` le reporterait au
  // 3 mars sans rien signaler. Seul l'aller-retour le démasque.
  const date = parseIsoDay(iso)
  return date && isoDay(date) === iso ? iso : null
}

/**
 * Rattache la catégorie annoncée à une catégorie qui existe vraiment.
 *
 * On ne crée jamais de catégorie depuis un import : un modèle qui
 * hésite entre « Restaurant » et « Resto » en fabriquerait deux, et le
 * tableau de bord se retrouverait avec des tranches en double.
 */
function resolveCategory(value: unknown, known: string[]): string {
  const fallback = known.find((n) => plain(n) === 'autre') ?? known[0] ?? ''
  if (typeof value !== 'string') return fallback

  const wanted = plain(value)
  if (!wanted) return fallback

  const exact = known.find((n) => plain(n) === wanted)
  if (exact) return exact

  // « Restaurant » et « Resto » ne se contiennent pas l'un l'autre : ils
  // divergent dès la cinquième lettre. Un préfixe commun d'au moins
  // quatre caractères les rapproche sans confondre « Transport » et
  // « Travaux », qui n'en partagent que trois.
  const loose = known.find((n) => sharedPrefix(plain(n), wanted) >= 4)
  return loose ?? fallback
}

function sharedPrefix(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/** Déballe `[…]`, `{ depenses: […] }`, `{ expenses: […] }`… */
function rowsOf(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const holder = parsed as Record<string, unknown>
    for (const key of Object.keys(holder)) {
      const value = holder[key]
      if (Array.isArray(value) && ['depenses', 'expenses', 'data', 'items', 'lignes', 'operations', 'transactions'].includes(plain(key))) {
        return value
      }
    }
    // Un objet seul : une dépense unique.
    if (field(holder, AMOUNT) !== undefined) return [holder]
  }
  return null
}

/**
 * @param known Noms des catégories de la personne, tels qu'ils sont en base.
 */
export function parseExpenseJson(raw: string, known: string[]): ImportResult {
  const text = unwrap(raw)
  if (!text) return EMPTY

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ...EMPTY, error: "Ce n'est pas du JSON valide. Recopie la réponse entière, accolades comprises." }
  }

  const list = rowsOf(parsed)
  if (!list) {
    return { ...EMPTY, error: 'Le JSON ne contient pas de liste de dépenses.' }
  }
  if (list.length === 0) {
    return { ...EMPTY, error: 'La liste est vide.' }
  }

  const rows: ImportRow[] = []
  const rejects: ImportReject[] = []

  list.slice(0, MAX_ROWS).forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      rejects.push({ index, reason: "ce n'est pas une dépense" })
      return
    }
    const row = entry as Record<string, unknown>

    const amount = cents(field(row, AMOUNT))
    if (amount === null) {
      rejects.push({ index, reason: 'montant illisible' })
      return
    }
    if (amount <= 0) {
      rejects.push({ index, reason: 'montant nul' })
      return
    }

    const spentOn = isoDate(field(row, DATE))
    if (!spentOn) {
      rejects.push({ index, reason: 'date illisible' })
      return
    }

    const rawLabel = field(row, LABEL)
    const label = typeof rawLabel === 'string' ? rawLabel.trim().slice(0, MAX_LABEL) : ''
    if (!label) {
      rejects.push({ index, reason: 'intitulé manquant' })
      return
    }

    rows.push({
      label,
      amountCents: amount,
      spentOn,
      categoryName: resolveCategory(field(row, CATEGORY), known),
    })
  })

  if (list.length > MAX_ROWS) {
    rejects.push({ index: MAX_ROWS, reason: `au-delà de ${MAX_ROWS} lignes, le reste est ignoré` })
  }

  return { rows, rejects, error: null }
}

/** Clé d'unicité d'une dépense : même jour, même montant, même intitulé. */
export function rowKey(row: { spentOn: string; amountCents: number; label: string }): string {
  return `${row.spentOn}|${row.amountCents}|${plain(row.label)}`
}

export function totalCents(rows: ImportRow[]): number {
  return rows.reduce((sum, r) => sum + r.amountCents, 0)
}

/**
 * Texte à remettre à l'IA avec les captures d'écran.
 *
 * Il vit ici, contre le lecteur, pour que les deux ne divergent pas :
 * si `parseExpenseJson` cesse d'accepter une forme, c'est cette invite
 * qu'il faut corriger en même temps. Les catégories proposées sont
 * celles de la personne, jamais une liste figée — une catégorie inventée
 * retomberait dans « Autre » sans qu'elle comprenne pourquoi.
 */
export function promptFor(known: string[]): string {
  return [
    "Voici des captures d'écran de mon relevé bancaire.",
    '',
    'Réponds uniquement par un tableau JSON, sans phrase avant ni après.',
    'Une entrée par dépense, avec exactement ces quatre champs :',
    '',
    '  {"date": "AAAA-MM-JJ", "libelle": "Nom du commerce", "montant": 12.34, "categorie": "Courses"}',
    '',
    `La catégorie doit être l'une de celles-ci, à l'identique : ${known.join(', ')}.`,
    "Si tu hésites, mets « Autre » plutôt que d'inventer une catégorie.",
    '',
    "N'inclus que des dépenses : ignore les virements reçus, les salaires",
    'et les remboursements. Les montants sont positifs, en euros.',
  ].join('\n')
}
