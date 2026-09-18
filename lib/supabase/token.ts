/**
 * Lecture locale du jeton de session, sans aller-retour réseau.
 *
 * Le proxy doit répondre à deux questions à chaque requête : « faut-il
 * rafraîchir le jeton ? » et « où rediriger ? ». Les deux se tranchent à
 * partir du contenu du jeton, qui voyage dans un cookie. Appeler Supabase
 * pour les poser coûtait un aller-retour sur CHAQUE requête, y compris
 * les préchargements de liens.
 *
 * On ne vérifie pas la signature ici, et ce n'est pas un raccourci : la
 * sécurité ne repose pas sur cette lecture. Un jeton forgé passerait la
 * redirection, puis **toutes** ses requêtes de données seraient rejetées
 * par Supabase, qui vérifie la signature, et filtrées par RLS. Ce qu'on
 * décide ici, c'est de l'aiguillage, pas de l'autorisation.
 *
 * Au moindre doute — format inconnu, découpage incohérent, JSON illisible
 * — on renvoie `null`, et l'appelant retombe sur la vérification complète.
 */

export type TokenClaims = {
  /** Identifiant de l'utilisateur. */
  sub: string
  /** Expiration, en secondes depuis epoch. */
  exp: number
}

/** En deçà, on repasse par Supabase pour rafraîchir avant expiration. */
export const REFRESH_MARGIN_SECONDS = 120

/**
 * Recompose la valeur du cookie de session.
 *
 * `@supabase/ssr` découpe les gros cookies en `…auth-token.0`, `.1`, etc.
 * L'ordre des morceaux n'est pas garanti par l'en-tête `Cookie`.
 */
function readCookieValue(
  all: { name: string; value: string }[],
): string | null {
  const whole = all.find((c) => /^sb-.*-auth-token$/.test(c.name))
  if (whole) return whole.value

  const chunks = all
    .filter((c) => /^sb-.*-auth-token\.\d+$/.test(c.name))
    .map((c) => ({ index: Number(c.name.split('.').pop()), value: c.value }))
    .sort((a, b) => a.index - b.index)

  if (chunks.length === 0) return null
  // Un morceau manquant donnerait du JSON tronqué : on préfère abandonner.
  if (chunks.some((c, i) => c.index !== i)) return null

  return chunks.map((c) => c.value).join('')
}

function decodeBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  } catch {
    return null
  }
}

/** Claims du jeton d'accès, ou `null` si quoi que ce soit cloche. */
export function readTokenClaims(
  cookies: { name: string; value: string }[],
): TokenClaims | null {
  const raw = readCookieValue(cookies)
  if (!raw) return null

  let json = raw
  if (raw.startsWith('base64-')) {
    const decoded = decodeBase64Url(raw.slice('base64-'.length))
    if (!decoded) return null
    json = decoded
  }

  let accessToken: unknown
  try {
    accessToken = JSON.parse(json)?.access_token
  } catch {
    return null
  }
  if (typeof accessToken !== 'string') return null

  const payload = accessToken.split('.')[1]
  if (!payload) return null

  const decoded = decodeBase64Url(payload)
  if (!decoded) return null

  try {
    const claims = JSON.parse(decoded)
    if (typeof claims?.sub !== 'string' || typeof claims?.exp !== 'number') {
      return null
    }
    return { sub: claims.sub, exp: claims.exp }
  } catch {
    return null
  }
}

/** Vrai si le jeton est valable assez longtemps pour éviter un refresh. */
export function isFresh(claims: TokenClaims, now = Date.now()): boolean {
  return claims.exp - Math.floor(now / 1000) > REFRESH_MARGIN_SECONDS
}
