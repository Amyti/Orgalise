import { CATEGORY_COLORS } from './palette'
import type { Category } from './types'

/**
 * Couleur d'une catégorie, résolue depuis la charte plutôt que depuis la
 * base.
 *
 * `categories.color` est renseignée par le trigger `seed_categories` au
 * moment de l'inscription : elle fige la charte de ce jour-là. Comme les
 * huit catégories par défaut ne changent jamais de nom, les résoudre par
 * nom laisse la palette faire autorité — et une nouvelle charte s'applique
 * sans toucher à la base.
 *
 * Une catégorie renommée ou ajoutée à la main retombe sur sa couleur
 * stockée, qui est alors un vrai choix de l'utilisateur.
 */
export function categoryColor(category: Pick<Category, 'name' | 'color'>): string {
  const known = (CATEGORY_COLORS as Record<string, string>)[category.name]
  return known ?? category.color
}

/** Applique la charte à une liste de catégories venue de la base. */
export function withPaletteColors(categories: Category[]): Category[] {
  return categories.map((c) => ({ ...c, color: categoryColor(c) }))
}
