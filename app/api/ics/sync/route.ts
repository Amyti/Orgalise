import { NextResponse } from 'next/server'

import { syncMyFeeds } from '@/lib/sync'

/**
 * Synchro des calendriers perso, déclenchée à l'ouverture de l'app.
 *
 * CLAUDE.md : le cron Vercel gratuit se limite à une exécution par jour,
 * ce qui est trop peu pour un agenda. On synchronise donc quand quelqu'un
 * ouvre l'app — `syncMyFeeds` saute les flux déjà frais.
 */
export async function POST() {
  try {
    const results = await syncMyFeeds()
    return NextResponse.json({ results })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Synchro impossible.' },
      { status: 500 },
    )
  }
}
