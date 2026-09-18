/**
 * Les couleurs qui finissent **en base de données**.
 *
 * Tout le reste passe par les tokens de `app/globals.css`. Une couleur de
 * profil ou de catégorie est stockée en clair dans Postgres : elle ne peut
 * pas être une `var(--…)`.
 */

export const USER_A = '#A94F2E' // personne 1 — terracotta
export const USER_B = '#4F6549' // personne 2 — olive

/** Fond de l'app, pour le manifeste PWA et la barre d'état du téléphone. */
export const GROUND = '#F5F1E8'
export const GROUND_DARK = '#191712'

/** Catégories de dépenses : même chroma, même clarté. */
export const CATEGORY_COLORS = {
  Courses: '#A94F2E',
  Resto: '#C4703F',
  Transport: '#3F6B70',
  Loisirs: '#8A5A2B',
  Logement: '#4F6549',
  Santé: '#9B4B62',
  Abonnements: '#6B5A8A',
  Autre: '#7A7263',
} as const
