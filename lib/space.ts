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

  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!membership) return null

  const [{ data: group }, { data: members }] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, invite_code, created_by')
      .eq('id', membership.group_id)
      .maybeSingle(),
    supabase
      .from('group_members')
      .select('user_id, role, joined_at')
      .eq('group_id', membership.group_id)
      .order('joined_at', { ascending: true }),
  ])

  if (!group) return null

  // Deux requêtes plutôt qu'une jointure : `group_members.user_id` et
  // `profiles.id` pointent tous deux vers `auth.users`, sans clé étrangère
  // entre eux. PostgREST ne sait donc pas imbriquer les deux tables, et
  // `select('…, profiles(…)')` échoue en PGRST200. Deux lignes au maximum,
  // le coût est nul.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, color')
    .in('id', (members ?? []).map((m) => m.user_id))

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
