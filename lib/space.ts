import { cache } from 'react'
import { redirect } from 'next/navigation'

import { LOGIN_PATH } from './config'
import { USER_A, USER_B } from './palette'
import { createClient } from './supabase/server'
import type { Member, Space } from './types'

/**
 * Résolution de l'espace courant.
 *
 * Deux utilisateurs en tout (CLAUDE.md) : pas de sélecteur de groupe,
 * on prend le premier — et le seul. `cache()` évite de refaire la
 * requête pour chaque composant du même rendu.
 */

export const currentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export async function requireUser() {
  const user = await currentUser()
  if (!user) redirect(LOGIN_PATH)
  return user
}

export const currentSpace = cache(async (): Promise<Space | null> => {
  const user = await currentUser()
  if (!user) return null

  const supabase = await createClient()

  // Trois requêtes en UNE vague au lieu de trois à la suite.
  //
  // C'est RLS qui le permet : `groups` n'est visible que via
  // `is_group_member`, `group_members` que pour son propre espace, et
  // `profiles` que pour soi et ses co-membres. Sans filtre, chacune ne
  // renvoie donc que ce qui nous concerne — et aucune n'a besoin du
  // résultat des autres. Deux utilisateurs, un espace : le volume rend
  // l'absence de filtre sans conséquence (CLAUDE.md : ne pas
  // sur-architecturer pour le multi-tenant).
  const [{ data: groups }, { data: members }, { data: profiles }] =
    await Promise.all([
      supabase.from('groups').select('id, name, invite_code, created_by').limit(1),
      supabase
        .from('group_members')
        .select('user_id, role, joined_at')
        .order('joined_at', { ascending: true }),
      supabase.from('profiles').select('id, display_name, color'),
    ])

  const group = groups?.[0]
  if (!group) return null

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  // La couleur d'une personne découle de sa PLACE dans l'espace, pas de
  // l'hex stocké en base. L'app n'offre aucun sélecteur de couleur : la
  // valeur en base n'est qu'un reflet de la charte du jour. En la
  // dérivant au rendu, un changement de palette s'applique partout
  // immédiatement, sans migration SQL.
  const slots = [USER_A, USER_B]
  const people: Member[] = (members ?? []).flatMap((row, index) => {
    const profile = byId.get(row.user_id)
    if (!profile) return []
    return [
      {
        id: profile.id,
        display_name: profile.display_name,
        color: slots[index] ?? profile.color,
        role: row.role,
        joined_at: row.joined_at,
      },
    ]
  })

  const me = people.find((p) => p.id === user.id)
  if (!me) return null

  return {
    group,
    me,
    partner: people.find((p) => p.id !== user.id) ?? null,
  }
})

/** Pour les écrans internes : sans espace, on renvoie au parcours d'entrée. */
export async function requireSpace(): Promise<Space> {
  await requireUser()
  const space = await currentSpace()
  if (!space) redirect('/groupe')
  return space
}

/** Initiale affichée dans les pastilles. */
export function initial(member: { display_name: string }): string {
  return (member.display_name.trim()[0] ?? '?').toUpperCase()
}
