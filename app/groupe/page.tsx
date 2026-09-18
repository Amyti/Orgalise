import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ChevronLeftIcon } from '@/components/Icons'
import { landingPath } from '@/lib/modules'
import { currentSpace, requireProfile } from '@/lib/space'
import { GroupeForms } from './GroupeForms'
import styles from './groupe.module.css'

export const metadata: Metadata = { title: 'Votre espace commun' }

export default async function GroupePage() {
  const profile = await requireProfile()
  // Sans l'agenda, un espace partagé n'a aucune utilité.
  if (!profile.modules.agenda) redirect(landingPath(profile.modules))

  // Déjà dans un espace : ce parcours est derrière nous.
  if (await currentSpace()) redirect('/accueil')

  return (
    <div className={`screen ${styles.screen}`}>
      <div className={styles.header}>
        <Link href="/connexion" className="backLink" aria-label="Retour">
          <ChevronLeftIcon size={19} color="var(--ink)" />
        </Link>
      </div>

      <div className={styles.intro}>
        <h1 className={`display ${styles.title}`}>Votre espace commun</h1>
        <p className={styles.subtitle}>
          Un espace = un agenda partagé, vos deux calendriers perso et le suivi
          de vos dépenses.
        </p>
      </div>

      <GroupeForms />
    </div>
  )
}
