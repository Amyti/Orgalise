/**
 * État du formulaire de connexion.
 *
 * Volontairement hors de `actions.ts` : un module `'use server'` ne peut
 * exporter que des fonctions async. Une constante y serait transformée en
 * référence d'action côté client, et `state.status` vaudrait `undefined`.
 */
export type AuthState = {
  status: 'idle' | 'error' | 'sent'
  message: string
  /** Champ à mettre en évidence quand l'erreur vient d'une saisie. */
  field?: 'email' | 'password'
  /** Renvoyé pour repeupler le formulaire après un aller-retour serveur. */
  email?: string
}

export const initialAuthState: AuthState = { status: 'idle', message: '' }
