import type { Metadata, Viewport } from 'next'
import { Fraunces, Karla } from 'next/font/google'

import { APP_NAME } from '@/lib/config'
import { GROUND, GROUND_DARK } from '@/lib/palette'
import { THEME_KEY } from '@/components/ThemeToggle'
import './globals.css'

/**
 * Applique le thème choisi avant le premier rendu.
 *
 * Sans ce script, la page s'afficherait une fraction de seconde dans le
 * thème du système avant que React ne remette celui de l'utilisateur —
 * un flash blanc désagréable sur un téléphone, la nuit.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`

// Fraunces et Karla sont des polices variables : pas de liste de graisses
// à déclarer, `font-weight` en CSS suffit.
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
})

const karla = Karla({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-karla',
})

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description:
    'Un agenda commun, vos dispos côte à côte, et les dépenses qui vont avec.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/icone-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // La PWA installée déborde sous l'encoche : on gère les marges en CSS.
  viewportFit: 'cover',
  // La barre d'état du téléphone suit le thème.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: GROUND },
    { media: '(prefers-color-scheme: dark)', color: GROUND_DARK },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${karla.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
