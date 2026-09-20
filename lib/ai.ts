import 'server-only'

/**
 * Lecture de captures d'écran bancaires par un modèle de vision.
 *
 * La clé ne quitte jamais le serveur : les images montent depuis le
 * téléphone vers une action serveur, qui appelle l'API et ne renvoie que
 * du texte. Le modèle ne touche jamais la base — ce qu'il produit repart
 * dans `parseExpenseJson`, qui reste seul juge de ce qui est écrit.
 */

/*
 * Haiku 4.5 : cette tâche est de la lecture de tableau, pas du
 * raisonnement, et l'écran d'aperçu rattrape une erreur avant qu'elle
 * n'atteigne la base. C'est aussi le moins cher des modèles de vision
 * de la famille. Passer à 'claude-sonnet-5' ne demande que de changer
 * cette ligne, si les relevés s'avéraient trop coriaces.
 *
 * Les jetons de sortie coûtent cinq fois ceux d'entrée : c'est pourquoi
 * l'invite réclame une forme compacte plutôt que des objets nommés.
 */
const MODEL = 'claude-haiku-4-5-20251001'

/**
 * Plafond de sortie.
 *
 * On ne paie que ce qui est réellement produit ; ce nombre borne le pire
 * cas plutôt qu'il ne fixe un coût. Au format compact, une dépense pèse
 * une quinzaine de jetons : 3 000 en couvrent deux cents, soit largement
 * de quoi encaisser un relevé PDF de plusieurs pages sans que la réponse
 * soit coupée en plein tableau — auquel cas le JSON serait illisible et
 * tout l'import perdu.
 */
const MAX_TOKENS = 3000

/**
 * Plafond de pièces par import.
 *
 * Il a valu 6, et rognait en silence : quelqu'un qui en choisissait onze
 * en voyait cinq disparaître sans un mot, et croyait le modèle mauvais.
 * Depuis qu'on envoie une requête par pièce, la fiabilité ne dépend plus
 * du nombre ; seule la taille de l'envoi compte, et le navigateur la
 * découpe en plusieurs requêtes. Ce nombre n'est donc qu'un garde-fou
 * large.
 */
export const MAX_IMAGES = 24

/**
 * Une pièce à lire : capture d'écran ou relevé PDF.
 *
 * Le PDF est le meilleur des deux — un relevé mensuel est complet et
 * exact, là où des captures laissent toujours des trous — mais tout le
 * monde ne sait pas en sortir un de son appli bancaire. Les deux
 * coexistent, et rien n'empêche d'en mêler dans un même envoi.
 */
export type Piece = { kind: 'image' | 'pdf'; mediaType: string; base64: string }

export type VisionResult =
  | { ok: true; texts: string[]; failed: number }
  | { ok: false; message: string }

export function hasAiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * Fait lire chaque pièce par le modèle, **une requête par pièce**.
 *
 * Tout envoyer d'un coup semblait économique : une seule invite, un seul
 * aller-retour. Sauf qu'on demandait alors au modèle d'énumérer sans
 * faute une centaine de lignes réparties sur plusieurs images, et il en
 * sautait. Découpée en tâches courtes, chacune tient dans son attention.
 *
 * Le surcoût est l'invite répétée, environ 280 jetons par pièce, soit
 * une fraction de centime. Les lignes manquantes coûtaient plus cher.
 *
 * Les requêtes partent en parallèle : à trois captures, c'est aussi
 * rapide qu'avant.
 */
export async function readReceipts(pieces: Piece[], prompt: string): Promise<VisionResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return { ok: false, message: "La lecture automatique n'est pas configurée sur ce serveur." }
  }
  if (pieces.length === 0) {
    return { ok: false, message: 'Choisis au moins une capture ou un relevé.' }
  }

  const results = await Promise.all(
    pieces.map((piece, index) => readOne(key, piece, prompt, index, pieces.length)),
  )

  const texts = results.filter((r): r is string => r !== null)
  if (texts.length === 0) {
    return { ok: false, message: "Rien n'a pu être lu. Réessaie dans un instant." }
  }

  return { ok: true, texts, failed: results.length - texts.length }
}

/** Une pièce, une requête. `null` si celle-ci a échoué. */
async function readOne(
  key: string,
  piece: Piece,
  prompt: string,
  index: number,
  total: number,
): Promise<string | null> {
  // Situer la pièce évite qu'il croie devoir couvrir tout le relevé, et
  // qu'il invente le reste ou s'arrête trop tôt.
  const situation =
    total > 1
      ? `\n\nCeci est la pièce ${index + 1} sur ${total}. Relève uniquement ce qu'elle contient, en entier.`
      : ''

  const content = [
    {
      type: (piece.kind === 'pdf' ? 'document' : 'image') as 'document' | 'image',
      source: { type: 'base64' as const, media_type: piece.mediaType, data: piece.base64 },
    },
    { type: 'text' as const, text: prompt + situation },
  ]

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Relever un relevé n'est pas un exercice de style : on veut la
        // même réponse deux fois de suite.
        temperature: 0,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      console.error('[vision]', response.status, await response.text().catch(() => ''))
      return null
    }

    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[]
    }
    const text = (payload.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')

    return text.trim() ? text : null
  } catch (error) {
    console.error('[vision]', error)
    return null
  }
}
