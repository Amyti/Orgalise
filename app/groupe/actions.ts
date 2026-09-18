'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { USER_A, USER_B } from '@/lib/palette'
import { CODE_LENGTH, type GroupState } from './state'

/**
 * Création et rejointe d'un espace.
 *
 * Les deux passent par les fonctions SECURITY DEFINER du schéma : elles
 * gèrent le code d'invitation, la limite à deux membres, et la lecture de
 * `groups` avant d'en être membre (impossible sous RLS autrement).
 */

function frenchError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('code invalide')) return "Ce code ne correspond à aucun espace."
  if (m.includes('complet')) return 'Cet espace a déjà ses deux membres.'
  if (m.includes('non authentifié')) return 'Session expirée. Reconnecte-toi.'
  if (m.includes('fetch failed') || m.includes('network'))
    return 'Connexion au serveur impossible. Vérifie ton réseau.'
  return "Ça n'a pas marché. Réessaie."
}

export async function createSpace(
  _prev: GroupState,
  formData: FormData,
): Promise<GroupState> {
  const name = String(formData.get('name') ?? '').trim().slice(0, 40)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_group', {
    group_name: name || 'Nous deux',
  })

  if (error || !data) {
    return { status: 'error', message: frenchError(error?.message ?? ''), form: 'create' }
  }

  await seedProfile('a')
  redirect('/espace')
}

export async function joinSpace(
  _prev: GroupState,
  formData: FormData,
): Promise<GroupState> {
  const code = String(formData.get('code') ?? '').trim().toUpperCase()

  if (code.length !== CODE_LENGTH) {
    return {
      status: 'error',
      message: `Le code fait ${CODE_LENGTH} caractères.`,
      form: 'join',
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('join_group', { code })

  if (error || !data) {
    return { status: 'error', message: frenchError(error?.message ?? ''), form: 'join' }
  }

  await seedProfile('b')
  redirect('/espace')
}

/**
 * Le trigger `handle_new_user` crée le profil avec « Moi » et la couleur
 * de la personne 1. Deux profils identiques rendraient les deux rubans
 * indistinguables : on fixe ici le nom et la couleur du second arrivant.
 */
async function seedProfile(slot: 'a' | 'b') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, color')
    .eq('id', user.id)
    .maybeSingle()

  const patch: { display_name?: string; color?: string } = {}

  if (!profile || profile.display_name === 'Moi') {
    patch.display_name = nameFromEmail(user.email ?? '')
  }
  // Couleur posée explicitement, sans compter sur la valeur par défaut du
  // schéma : deux profils de la même couleur rendraient les deux rubans
  // indistinguables.
  const wanted = slot === 'a' ? USER_A : USER_B
  if (!profile || profile.color !== wanted) patch.color = wanted

  if (Object.keys(patch).length > 0) {
    await supabase.from('profiles').update(patch).eq('id', user.id)
  }
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  if (!local) return 'Moi'
  return local.charAt(0).toUpperCase() + local.slice(1, 20)
}
