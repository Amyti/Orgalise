'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Lance la synchro iCal à l'ouverture de l'app, une fois par session
 * d'onglet. Le serveur ignore les flux déjà frais, donc un rechargement
 * de page ne redéclenche pas de téléchargement.
 */
export function SyncOnOpen() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    try {
      if (sessionStorage.getItem('ics-synced') === '1') return
      sessionStorage.setItem('ics-synced', '1')
    } catch {
      // Navigation privée : on synchronise quand même, sans mémoriser.
    }

    fetch('/api/ics/sync', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.results) return
        // Rafraîchir seulement si la synchro a réellement écrit quelque chose.
        const changed = data.results.some(
          (r: { status: string }) => r.status === 'ok',
        )
        if (changed) router.refresh()
      })
      .catch(() => {
        // Hors ligne : les données déjà en base restent affichées.
      })

    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
