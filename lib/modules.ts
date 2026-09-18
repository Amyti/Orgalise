/**
 * Les deux outils de l'app, activables indépendamment.
 *
 * Le suivi de dépenses est strictement personnel — ses tables sont en
 * `user_id = auth.uid()`, sans aucun `group_id`. Il fonctionne donc sans
 * espace partagé, et quelqu'un qui vient pour ça seul n'a pas à créer un
 * espace ni à inviter personne.
 */

export const MODULES = ['agenda', 'budget'] as const
export type ModuleName = (typeof MODULES)[number]

export type Modules = {
  agenda: boolean
  budget: boolean
  /** Faux tant que la personne n'a pas choisi : déclenche l'accueil. */
  chosen: boolean
}

/** Lit la colonne `profiles.modules`, en ignorant les valeurs inconnues. */
export function readModules(raw: unknown): Modules {
  const list = Array.isArray(raw) ? raw.filter((m): m is ModuleName =>
    (MODULES as readonly string[]).includes(m)) : []
  return {
    agenda: list.includes('agenda'),
    budget: list.includes('budget'),
    chosen: list.length > 0,
  }
}

export function toColumn(modules: Pick<Modules, 'agenda' | 'budget'>): ModuleName[] {
  const list: ModuleName[] = []
  if (modules.agenda) list.push('agenda')
  if (modules.budget) list.push('budget')
  return list
}

/** Premier écran utile, selon les outils activés. */
export function landingPath(modules: Modules): string {
  if (!modules.chosen) return '/demarrer'
  if (modules.agenda) return '/accueil'
  return '/budget'
}
