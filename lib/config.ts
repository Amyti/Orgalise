/**
 * Nom de l'app. Source unique : écran de connexion, titre des pages,
 * manifeste PWA et nom sous l'icône sur l'écran d'accueil.
 */
export const APP_NAME = 'Orgalise'

/**
 * Écran d'entrée après authentification.
 *
 * Il mène au choix des outils, pas directement à la création d'un espace :
 * quelqu'un qui vient pour ses dépenses n'en a pas besoin. `/demarrer`
 * redirige lui-même si le choix est déjà fait.
 */
export const AFTER_LOGIN_PATH = '/demarrer'

export const LOGIN_PATH = '/connexion'
