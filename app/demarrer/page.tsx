import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LOGIN_PATH } from '@/lib/config'
import { landingPath } from '@/lib/modules'
import { currentProfile } from '@/lib/space'
import { ModuleChoice } from './ModuleChoice'
import styles from './demarrer.module.css'

export const metadata: Metadata = { title: 'Bienvenue' }

/**
 * Premier écran après l'inscription.
 *
 * Il est hors de `(app)` : la barre de navigation n'a pas de sens tant
 * qu'on ne sait pas quels onglets afficher.
 */
export default async function DemarrerPage() {
  const profile = await currentProfile()
  if (!profile) redirect(LOGIN_PATH)
  // Choix déjà fait : on ne repose pas la question.
  if (profile.modules.chosen) redirect(landingPath(profile.modules))

  return (
    <div className={`screen ${styles.screen}`}>
      <div className={styles.head}>
        <h1 className={`display ${styles.title}`}>
          Qu'est-ce qui
          <br />
          te servirait ?
        </h1>
        <p className={styles.lede}>
          Les deux fonctionnent séparément. Prends ce dont tu as besoin.
        </p>
      </div>

      <ModuleChoice current={profile.modules} />
    </div>
  )
}
