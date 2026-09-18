import type { MetadataRoute } from 'next'

import { APP_NAME } from '@/lib/config'
import { GROUND } from '@/lib/palette'

/**
 * Manifeste PWA.
 *
 * CLAUDE.md : pas d'app native, donc pas de compte Apple à 99 $/an.
 * Sur iPhone l'installation passe obligatoirement par Safari
 * (Partager → Sur l'écran d'accueil) ; Chrome iOS ne sait pas le faire.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description:
      'Un agenda commun, vos dispos côte à côte, et les dépenses qui vont avec.',
    lang: 'fr',
    start_url: '/accueil',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: GROUND,
    theme_color: GROUND,
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
