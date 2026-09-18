import type { Metadata } from 'next'
import Link from 'next/link'

import { CheckIcon } from '@/components/Icons'
import { APP_NAME, LOGIN_PATH } from '@/lib/config'
import styles from './confirme.module.css'

export const metadata: Metadata = { title: 'Adresse confirmée' }

/**
 * Page d'arrivée après confirmation d'une adresse e-mail.
 *
 * Elle existe pour une raison précise à iOS : le lien du mail s'ouvre
 * dans Safari, jamais dans la PWA installée sur l'écran d'accueil. Or les
 * deux ne partagent pas leurs cookies. La session créée ici ne suivra
 * donc pas dans l'app — il faut s'y connecter une fois avec ses
 * identifiants. Renvoyer directement vers l'accueil donnerait l'illusion
 * d'être connecté, puis un écran de connexion inattendu au retour.
 */
export default function ConfirmePage() {
  return (
    <div className={`screen ${styles.screen}`}>
      <div className={styles.center}>
        <div className={styles.badge}>
          <CheckIcon size={30} color="var(--on-strong)" width={2.4} />
        </div>

        <h1 className={`display ${styles.title}`}>Adresse confirmée</h1>

        <p className={styles.body}>
          Ton compte est prêt. Ouvre {APP_NAME} et connecte-toi avec ton
          adresse et ton mot de passe.
        </p>

        <div className={styles.tip}>
          Si tu as ajouté {APP_NAME} à ton écran d'accueil, reviens-y depuis
          l'icône : c'est là que tu resteras connecté.
        </div>
      </div>

      <div className={styles.foot}>
        <Link href={LOGIN_PATH} className="btnPrimary">
          Se connecter
        </Link>
      </div>
    </div>
  )
}
