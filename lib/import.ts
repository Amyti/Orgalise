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
import { isoDay, parseIsoDay, wall } from './dates'
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

/**
 * Isole le premier tableau ou objet JSON d'un texte qui en contient
 * d'autres choses.
 *
 * Nécessaire depuis qu'on laisse le modèle s'exprimer avant de répondre :
 * lui imposer de commencer par « [ » le privait de toute marge pour
 * examiner l'image, et il omettait des lignes. Mieux vaut le laisser
 * dire « Voici les 62 opérations relevées : » et savoir ignorer cette
 * phrase.
 *
 * On compte les accolades en tenant compte des chaînes, sinon un
 * libellé contenant « ] » couperait le tableau au mauvais endroit.
 */
function carve(text: string): string {
  const start = text.search(/[[{]/)
  if (start === -1) return text

  const opening = text[start]
  const closing = opening === '[' ? ']' : '}'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (c === '\\') {
      escaped = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (c === opening) depth++
    else if (c === closing) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return text.slice(start)
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
export function parseExpenseJson(
  raw: string,
  known: string[],
  /** Sert à écarter les dates futures. Injectable pour les tests. */
  now: Date = new Date(),
): ImportResult {
  const text = unwrap(raw)
  if (!text) return EMPTY

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Deuxième chance : le JSON est peut-être noyé dans du texte.
    try {
      parsed = JSON.parse(carve(text))
    } catch {
      return { ...EMPTY, error: "Ce n'est pas du JSON valide. Recopie la réponse entière, accolades comprises." }
    }
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
  // Une dépense ne peut pas être dans le futur. Garde-fou indépendant de
  // l'invite : un modèle qui se trompe d'année le fait silencieusement,
  // et la dépense atterrit dans un mois qu'on ne regardera jamais.
  const today = isoDay(now)

  list.slice(0, MAX_ROWS).forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      rejects.push({ index, reason: "ce n'est pas une dépense" })
      return
    }
    // Forme compacte `["2026-09-14","Carrefour",42.9,"Courses"]` : on la
    // ramène aux mêmes clés que la forme développée avant de continuer.
    const row = Array.isArray(entry)
      ? spread(entry)
      : (entry as Record<string, unknown>)

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
    if (spentOn > today) {
      rejects.push({ index, reason: 'date dans le futur' })
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

/**
 * Range un tableau positionnel en champs nommés.
 *
 * On ne se fie pas à l'ordre annoncé : un modèle intervertit volontiers
 * l'intitulé et la catégorie. Chaque valeur est reconnue à sa nature —
 * ce qui ressemble à une date en est une, ce qui est un nombre est le
 * montant — et les chaînes restantes tombent dans l'ordre naturel,
 * intitulé puis catégorie.
 */
function spread(entry: unknown[]): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  const texts: unknown[] = []

  for (const value of entry) {
    if (row.date === undefined && isoDate(value) !== null) {
      row.date = value
    } else if (row.montant === undefined && cents(value) !== null && typeof value !== 'string') {
      row.montant = value
    } else {
      texts.push(value)
    }
  }

  // Un montant écrit « 42,90 » reste une chaîne : on le repêche ici.
  if (row.montant === undefined) {
    const i = texts.findIndex((t) => typeof t === 'string' && cents(t) !== null && /\d/.test(t))
    if (i >= 0) row.montant = texts.splice(i, 1)[0]
  }

  if (texts.length > 0) row.libelle = texts[0]
  if (texts.length > 1) row.categorie = texts[1]
  return row
}

/** Clé d'unicité d'une dépense : même jour, même montant, même intitulé. */
export function rowKey(row: { spentOn: string; amountCents: number; label: string }): string {
  return `${row.spentOn}|${row.amountCents}|${plain(row.label)}`
}

export function totalCents(rows: ImportRow[]): number {
  return rows.reduce((sum, r) => sum + r.amountCents, 0)
}

/**
 * Texte remis au modèle avec le relevé.
 *
 * Volontairement court. Une version précédente faisait le triple :
 * paragraphes en majuscules, liste d'interdictions, règles de déduction
 * détaillées. Elle produisait de moins bons résultats que quelques
 * phrases simples — le modèle dépensait son attention à respecter des
 * consignes au lieu de lire le document.
 *
 * Ne reste donc que ce qu'il ne peut pas deviner : la date du jour (un
 * relevé écrit « 14 sept. » sans année), le format attendu, les
 * catégories existantes, et le sens des opérations qui nous intéresse.
 * Tout le reste — dates futures, doublons, catégories inventées — est
 * rattrapé par le code, qui ne se fatigue pas et ne négocie pas.
 *
 * Si la lecture se dégrade, la tentation sera d'ajouter une règle ici.
 * C'est ce qui a échoué. Mieux vaut comparer avec ce que donne le même
 * modèle dans une interface de chat, qui sert d'étalon.
 */
export function promptFor(known: string[], now: Date = new Date()): string {
  const w = wall(now)

  return [
    `Voici mon relevé bancaire. Nous sommes le ${w.day} ${MOIS[w.month - 1]} ${w.year}.`,
    '',
    "Relève toutes les dépenses, c'est-à-dire l'argent qui sort du compte.",
    'Ni les virements reçus, ni les salaires, ni les soldes affichés.',
    '',
    'Réponds par un tableau JSON, une ligne par dépense :',
    '',
    '  ["AAAA-MM-JJ", "Nom du commerce", 12.34, "Courses"]',
    '',
    `Catégories possibles : ${known.join(', ')}. Mets « Autre » si tu hésites.`,
  ].join('\n')
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const
