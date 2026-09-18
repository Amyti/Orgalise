import 'server-only'

import { addDays } from './dates'
import { busyBlocks, fetchIcs } from './ics'
import { createClient } from './supabase/server'

/**
 * Synchronisation des calendriers perso.
 *
 * CLAUDE.md : le cron Vercel gratuit ne tourne qu'une fois par jour, donc
 * la synchro se fait **à l'ouverture de l'app**. Chacun ne synchronise que
 * ses propres flux — la policy RLS « écrire ses dispos » l'impose de toute
 * façon.
 */

/** Fenêtre entretenue en base : assez large pour la vue mois, pas plus. */
const WINDOW_BACK_DAYS = 7
const WINDOW_FORWARD_DAYS = 120

/** En deçà, on ne retélécharge pas : ouvrir l'app ne doit pas ramer. */
const FRESH_MINUTES = 30

const FETCH_TIMEOUT_MS = 12_000

export type SyncOutcome = {
  feedId: string
  label: string
  status: 'ok' | 'skipped' | 'error'
  blocks?: number
  message?: string
}

export async function syncMyFeeds(options?: { force?: boolean }): Promise<SyncOutcome[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: feeds } = await supabase
    .from('calendar_feeds')
    .select('id, label, url, last_synced_at, group_id')
    .eq('user_id', user.id)

  if (!feeds || feeds.length === 0) return []

  const now = new Date()
  const results: SyncOutcome[] = []

  for (const feed of feeds) {
    const fresh =
      feed.last_synced_at &&
      now.getTime() - new Date(feed.last_synced_at).getTime() <
        FRESH_MINUTES * 60_000

    if (fresh && !options?.force) {
      results.push({ feedId: feed.id, label: feed.label, status: 'skipped' })
      continue
    }

    results.push(await syncOne(feed, user.id, now))
  }

  return results
}

export async function syncFeed(feedId: string): Promise<SyncOutcome> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { feedId, label: '', status: 'error', message: 'Non connecté.' }

  const { data: feed } = await supabase
    .from('calendar_feeds')
    .select('id, label, url, last_synced_at, group_id')
    .eq('id', feedId)
    .maybeSingle()

  if (!feed) return { feedId, label: '', status: 'error', message: 'Flux introuvable.' }
  return syncOne(feed, user.id, new Date())
}

type FeedRow = {
  id: string
  label: string
  url: string
  group_id: string
}

async function syncOne(feed: FeedRow, userId: string, now: Date): Promise<SyncOutcome> {
  const windowStart = addDays(now, -WINDOW_BACK_DAYS)
  const windowEnd = addDays(now, WINDOW_FORWARD_DAYS)

  let text: string
  try {
    text = await fetchIcs(feed.url, AbortSignal.timeout(FETCH_TIMEOUT_MS))
  } catch (error) {
    return {
      feedId: feed.id,
      label: feed.label,
      status: 'error',
      message: readableError(error),
    }
  }

  let busy
  try {
    busy = busyBlocks(text, windowStart, windowEnd).busy
  } catch {
    return {
      feedId: feed.id,
      label: feed.label,
      status: 'error',
      message: "Ce calendrier n'a pas pu être lu.",
    }
  }

  const supabase = await createClient()

  // Remplacement de la fenêtre entière : un événement supprimé côté
  // calendrier doit disparaître ici aussi. Hors fenêtre, on ne touche à rien.
  const { error: deleteError } = await supabase
    .from('busy_blocks')
    .delete()
    .eq('feed_id', feed.id)
    .gte('starts_at', windowStart.toISOString())
    .lt('starts_at', windowEnd.toISOString())

  if (deleteError) {
    return {
      feedId: feed.id,
      label: feed.label,
      status: 'error',
      message: 'Écriture refusée par la base.',
    }
  }

  if (busy.length > 0) {
    const rows = busy.map((b) => ({
      feed_id: feed.id,
      user_id: userId,
      group_id: feed.group_id,
      starts_at: b.start.toISOString(),
      ends_at: b.end.toISOString(),
    }))

    // Par paquets : un gros calendrier dépasse la limite de payload.
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('busy_blocks').insert(rows.slice(i, i + 500))
      if (error) {
        return {
          feedId: feed.id,
          label: feed.label,
          status: 'error',
          message: 'Écriture refusée par la base.',
        }
      }
    }
  }

  await supabase
    .from('calendar_feeds')
    .update({ last_synced_at: now.toISOString() })
    .eq('id', feed.id)

  return { feedId: feed.id, label: feed.label, status: 'ok', blocks: busy.length }
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/timeout|aborted/i.test(message)) return 'Le calendrier met trop de temps à répondre.'
  if (/fetch failed|network|ENOTFOUND|EAI_AGAIN/i.test(message))
    return "L'adresse du calendrier est injoignable."
  return message
}
