/** État des formulaires du parcours d'entrée. Hors `actions.ts` : un
 *  module `'use server'` ne peut exporter que des fonctions async. */
export type GroupState = {
  status: 'idle' | 'error'
  message: string
  /** Quel des deux formulaires a échoué, pour n'alerter que celui-là. */
  form?: 'create' | 'join'
}

export const initialGroupState: GroupState = { status: 'idle', message: '' }

/** Alphabet du code d'invitation : ni 0/O ni 1/I/L (CLAUDE.md, décision 6). */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 6

/** Normalise une saisie : majuscules, caractères ambigus corrigés. */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/[IL]/g, '1')
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH)
}
