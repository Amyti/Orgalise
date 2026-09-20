/**
 * États et constantes des formulaires.
 *
 * Hors des modules `'use server'` : ceux-ci ne peuvent exporter que des
 * fonctions async. Une constante y serait transformée en référence
 * d'action côté client, et l'état initial vaudrait `undefined`.
 */

export type EspaceState = { status: 'idle' | 'error' | 'ok'; message: string }
export const initialEspaceState: EspaceState = { status: 'idle', message: '' }

export type EventState = { status: 'idle' | 'error'; message: string }
export const initialEventState: EventState = { status: 'idle', message: '' }

export type ExpenseState = { status: 'idle' | 'error'; message: string }
export const initialExpenseState: ExpenseState = { status: 'idle', message: '' }

/**
 * Récurrences proposées.
 *
 * CLAUDE.md, décision 3 : on stocke la RÈGLE, jamais les occurrences.
 * Quatre choix couvrent l'usage d'un couple ; la colonne accepte
 * n'importe quelle RRULE si le besoin vient plus tard.
 */
export const REPEATS = [
  { value: '', label: 'Ne se répète pas' },
  { value: 'FREQ=WEEKLY', label: 'Toutes les semaines' },
  { value: 'FREQ=WEEKLY;INTERVAL=2', label: 'Une semaine sur deux' },
  { value: 'FREQ=MONTHLY', label: 'Tous les mois' },
] as const

export const VALID_RRULES = new Set<string>(REPEATS.map((r) => r.value))

/**
 * Import d'un JSON de dépenses. Le compte des ignorées est aussi
 * important que celui des ajoutées : c'est lui qui explique pourquoi
 * un second import du même relevé ne change rien.
 */
export type ImportState = {
  status: 'idle' | 'error' | 'ok'
  message: string
  added: number
  skipped: number
}
export const initialImportState: ImportState = {
  status: 'idle',
  message: '',
  added: 0,
  skipped: 0,
}
