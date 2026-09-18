'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { LOGIN_PATH } from '@/lib/config'
import { currentSpace } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import { syncFeed } from '@/lib/sync'
import type { EspaceState } from './state'

/** Renomme la personne connectée. Affiché partout : pastilles, membres, rubans. */
export async function renameMe(
  _prev: EspaceState,
  formData: FormData,
): Promise<EspaceState> {
  const name = String(formData.get('display_name') ?? '').trim().slice(0, 24)
  if (!name) return { status: 'error', message: 'Un prénom, même court.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Session expirée.' }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', user.id)

  if (error) return { status: 'error', message: "Le nom n'a pas pu être changé." }

  revalidatePath('/', 'layout')
  return { status: 'ok', message: 'Nom mis à jour.' }
}

/** Renomme l'espace. Réservé à la personne qui l'a créé (policy « admin modifie »). */
export async function renameSpace(
  _prev: EspaceState,
  formData: FormData,
): Promise<EspaceState> {
  const name = String(formData.get('name') ?? '').trim().slice(0, 40)
  if (!name) return { status: 'error', message: "Il faut un nom à l'espace." }

  const space = await currentSpace()
  if (!space) return { status: 'error', message: 'Espace introuvable.' }

  const supabase = await createClient()
  const { error } = await supabase.from('groups').update({ name }).eq('id', space.group.id)

  if (error) {
    return {
      status: 'error',
      message: "Seule la personne qui a créé l'espace peut le renommer.",
    }
  }

  revalidatePath('/', 'layout')
  return { status: 'ok', message: 'Espace renommé.' }
}

/**
 * Branche un calendrier perso.
 *
 * On ne stocke que l'URL secrète iCal : pas d'OAuth Google (CLAUDE.md,
 * décision 5). La première synchro part tout de suite, sinon l'écran
 * afficherait un flux « branché » mais vide.
 */
export async function addFeed(
  _prev: EspaceState,
  formData: FormData,
): Promise<EspaceState> {
  const rawUrl = String(formData.get('url') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim().slice(0, 40)

  if (!rawUrl) return { status: 'error', message: "Colle l'adresse iCal de ton calendrier." }

  const url = rawUrl.replace(/^webcal:\/\//i, 'https://')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { status: 'error', message: "Cette adresse n'est pas une URL valide." }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { status: 'error', message: 'Il faut une adresse http(s) ou webcal.' }
  }

  const space = await currentSpace()
  if (!space) return { status: 'error', message: 'Espace introuvable.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calendar_feeds')
    .insert({
      user_id: space.me.id,
      group_id: space.group.id,
      label: label || 'Mon calendrier',
      url,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { status: 'error', message: "Le calendrier n'a pas pu être enregistré." }
  }

  const outcome = await syncFeed(data.id)
  revalidatePath('/', 'layout')

  if (outcome.status === 'error') {
    // Le flux reste branché : l'adresse est peut-être juste momentanément KO.
    return {
      status: 'error',
      message: `Calendrier enregistré, mais la synchro a échoué : ${outcome.message}`,
    }
  }

  return {
    status: 'ok',
    message: `Calendrier synchronisé — ${outcome.blocks ?? 0} plage(s) occupée(s).`,
  }
}

export async function removeFeed(formData: FormData): Promise<void> {
  const id = String(formData.get('feed_id') ?? '')
  if (!id) return

  const supabase = await createClient()
  // Les busy_blocks partent en cascade (ON DELETE CASCADE sur feed_id).
  await supabase.from('calendar_feeds').delete().eq('id', id)
  revalidatePath('/', 'layout')
}

/** Resynchronise à la demande, sans attendre la fenêtre de fraîcheur. */
export async function resyncFeed(formData: FormData): Promise<void> {
  const id = String(formData.get('feed_id') ?? '')
  if (!id) return
  await syncFeed(id)
  revalidatePath('/', 'layout')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(LOGIN_PATH)
}
