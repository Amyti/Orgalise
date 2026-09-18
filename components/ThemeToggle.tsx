'use client'

import { useEffect, useState } from 'react'

import styles from './theme.module.css'

export type Theme = 'system' | 'light' | 'dark'

export const THEME_KEY = 'orgalise-theme'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'system', label: 'Système' },
  { value: 'dark', label: 'Sombre' },
]

/**
 * Réglage du thème : trois états, comme le système lui-même.
 *
 * « Système » ne pose rien sur la racine et laisse `prefers-color-scheme`
 * décider ; un choix explicite pose `data-theme`, qui gagne sur l'OS.
 * Le script inline de `app/layout.tsx` applique la valeur avant le premier
 * rendu, sinon l'écran clignoterait en blanc au chargement.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  // Tant que le composant n'est pas monté, on ne connaît pas le choix
  // stocké : afficher un état actif au hasard ferait sauter le bouton.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY)
      if (stored === 'light' || stored === 'dark') setTheme(stored)
    } catch {
      // Navigation privée : on reste sur « Système ».
    }
    setReady(true)
  }, [])

  function choose(next: Theme) {
    setTheme(next)
    const root = document.documentElement
    if (next === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', next)

    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, next)
    } catch {
      // Le choix tiendra jusqu'au rechargement, sans être mémorisé.
    }
  }

  return (
    <div className={styles.group} role="group" aria-label="Apparence">
      {OPTIONS.map((option) => {
        const active = ready && theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.option} ${active ? styles.optionOn : ''}`}
            onClick={() => choose(option.value)}
            aria-pressed={active}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
