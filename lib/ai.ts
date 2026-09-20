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

/** Au-delà, l'envoi devient lourd et la lecture perd en fiabilité. */
export const MAX_IMAGES = 6

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
  | { ok: true; text: string }
  | { ok: false; message: string }

export function hasAiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function readReceipts(pieces: Piece[], prompt: string): Promise<VisionResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return { ok: false, message: "La lecture automatique n'est pas configurée sur ce serveur." }
  }
  if (pieces.length === 0) {
    return { ok: false, message: 'Choisis au moins une capture ou un relevé.' }
  }

  const content = [
    ...pieces.map((p) => ({
      type: (p.kind === 'pdf' ? 'document' : 'image') as 'document' | 'image',
      source: { type: 'base64' as const, media_type: p.mediaType, data: p.base64 },
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
        /*
         * Relever un relevé n'est pas un exercice de style : on veut la
         * même réponse deux fois de suite, et la lecture la plus probable
         * plutôt qu'une lecture inventive.
         */
        temperature: 0,
        /*
         * Pas de préremplissage.
         *
         * On a d'abord commencé la réponse à sa place par « [ », pour
         * qu'il n'ait aucun endroit où glisser « Voici les dépenses
         * relevées : ». Ça marchait — et il omettait des lignes. Forcé
         * d'émettre des données dès le premier jeton, il n'avait plus
         * aucune marge pour parcourir l'image.
         *
         * Le même modèle appelé sans cette contrainte relève une
         * soixantaine d'opérations là où il en rendait cinquante-six.
         * `parseExpenseJson` sait désormais isoler le tableau au milieu
         * d'un texte : la phrase d'introduction coûte quelques jetons et
         * les lignes manquantes coûtaient bien plus.
         */
        messages: [{ role: 'user', content }],
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
        : response.status === 400
          // Un relevé protégé par mot de passe échoue ici, et le dire
          // épargne de chercher du côté de la clé ou du réseau.
          ? "Ce fichier n'a pas pu être lu. S'il s'agit d'un PDF protégé par mot de passe, enlève la protection d'abord."
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
    return { ok: false, message: "Rien n'a été lu dans ces fichiers." }
  }

  return { ok: true, text }
}
