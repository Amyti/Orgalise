/**
 * Montants.
 *
 * Règle de CLAUDE.md : des entiers de centimes, jamais de float.
 * Les conversions vers/depuis l'affichage sont toutes ici.
 */

/** 1250 → « 12,50 € » */
export function euros(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${sign}${groupThousands(whole)},${rest} €`
}

/** 1250 → « 12 € » — pour les gros chiffres où les centimes parasitent. */
export function roundedEuros(cents: number): string {
  return `${groupThousands(Math.round(cents / 100))} €`
}

function groupThousands(n: number): string {
  // Espace fine insécable, comme l'usage typographique français.
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** « 12,50 » ou « 12.5 » → 1250. `null` si ce n'est pas un montant. */
export function parseCents(input: string): number | null {
  const cleaned = input.trim().replace(/\s| |€/g, '').replace(',', '.')
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null

  const [whole, frac = ''] = cleaned.split('.')
  const cents = (frac + '00').slice(0, 2)
  const value = Number(whole || '0') * 100 + Number(cents)
  return Number.isFinite(value) ? value : null
}

/** Ce que le pavé numérique affiche pendant la saisie : « 12,5 » reste « 12,5 ». */
export function formatDraft(draft: string): string {
  if (draft === '') return '0'
  return draft.replace('.', ',')
}
