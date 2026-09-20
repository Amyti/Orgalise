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
 * une quinzaine de jetons : 2 000 en couvrent bien plus de cent, soit
 * davantage que ce que six captures peuvent contenir.
 */
const MAX_TOKENS = 2000

/** Au-delà, l'envoi devient lourd et la lecture perd en fiabilité. */
export const MAX_IMAGES = 6

export type Shot = { mediaType: string; base64: string }

export type VisionResult =
  | { ok: true; text: string }
  | { ok: false; message: string }

export function hasAiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function readReceipts(shots: Shot[], prompt: string): Promise<VisionResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return { ok: false, message: "La lecture automatique n'est pas configurée sur ce serveur." }
  }
  if (shots.length === 0) {
    return { ok: false, message: 'Choisis au moins une capture.' }
  }

  const content = [
    ...shots.map((s) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: s.mediaType, data: s.base64 },
    })),
    { type: 'text' as const, text: prompt },
  ]

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'user', content },
          /*
           * On commence la réponse à sa place par un crochet ouvrant.
           * Le modèle n'a plus d'endroit où glisser « Voici les dépenses
           * que j'ai relevées : » — il poursuit le tableau, un point
           * c'est tout.
           */
          { role: 'assistant', content: '[' },
        ],
      }),
    })
  } catch {
    return { ok: false, message: "Le service de lecture n'a pas répondu. Réessaie." }
  }

  if (!response.ok) {
    // 429 et 529 sont passagers ; le reste relève de la configuration.
    const passager = response.status === 429 || response.status === 529
    return {
      ok: false,
      message: passager
        ? 'Le service de lecture est saturé. Réessaie dans un instant.'
        : `La lecture a échoué (erreur ${response.status}).`,
    }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, message: 'Réponse illisible du service de lecture.' }
  }

  const blocks = (payload as { content?: { type: string; text?: string }[] }).content ?? []
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')

  if (!text.trim()) {
    return { ok: false, message: "Rien n'a été lu sur ces captures." }
  }

  // Le crochet qu'on a écrit nous-même ne revient pas dans la réponse.
  return { ok: true, text: `[${text}` }
}
