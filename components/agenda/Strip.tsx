import { bandPosition, type DayView } from '@/lib/agenda'
import type { Interval } from '@/lib/intervals'
import styles from './strip.module.css'

type Band = { from: number; to: number }

type Props = {
  day: DayView
  band: Band
  /** Couleurs des deux personnes, dans l'ordre : moi, l'autre. */
  colors: { mine: string; theirs: string }
  height: number
  /** Marge verticale des rubans par rapport au bord de la bande.
   *  Serrée volontairement : chaque pixel gagné va à la hauteur des
   *  rubans, dont le contour a besoin de place pour ne pas moirer. */
  inset?: number
  /** Sur l'accueil la bande n'a ni fond blanc ni contour. */
  bare?: boolean
}

/**
 * Une journée résumée sur une bande horizontale.
 *
 * L'ordre d'empilement porte le sens : le honey est au fond (le temps
 * disponible), les rubans occupés par-dessus, et le bloc plein d'un
 * événement commun recouvre tout — c'est ce qui est vraiment décidé.
 */
export function Strip({ day, band, colors, height, inset = 4, bare }: Props) {
  return (
    <div
      className={`${styles.strip} ${bare ? styles.stripBare : ''}`}
      style={{ height }}
    >
      {day.free.map((free, i) => (
        <Block key={`f-${i}`} interval={free} day={day} band={band} className={styles.free} />
      ))}

      <div className={styles.lanes} style={{ top: inset, bottom: inset }}>
        <div className={styles.lane}>
          {day.mine.map((busy, i) => (
            <Block
              key={`m-${i}`}
              interval={busy}
              day={day}
              band={band}
              className={styles.ribbon}
              style={{ background: fill(colors.mine) }}
            />
          ))}
        </div>
        <div className={styles.lane}>
          {day.theirs.map((busy, i) => (
            <Block
              key={`t-${i}`}
              interval={busy}
              day={day}
              band={band}
              className={styles.ribbon}
              style={{ background: fill(colors.theirs) }}
            />
          ))}
        </div>
      </div>

      {day.events.map((occurrence, i) => (
        <Block
          key={`e-${i}`}
          interval={{ start: occurrence.start, end: occurrence.end }}
          day={day}
          band={band}
          className={styles.event}
          style={{ top: inset, bottom: inset }}
        />
      ))}
    </div>
  )
}

/**
 * Couleurs venues de la base (profils, catégories) adaptées au thème.
 *
 * Elles ne peuvent pas être des tokens : un profil stocke un hex en clair
 * dans Postgres. `color-mix` les recalcule donc au moment du rendu, et les
 * quatre tokens `--line-*` / `--fill-*` basculent avec le thème — en clair
 * le contour fonce, en sombre il s'éclaircit.
 */
export function line(color: string): string {
  if (color === 'transparent') return 'transparent'
  return `color-mix(in oklab, ${color} var(--line-amount), var(--line-into))`
}

/**
 * Aplat d'une plage occupée. En clair la couleur passe telle quelle ; en
 * sombre elle est rabattue vers le fond, sinon un bloc de pleine hauteur
 * brûlerait l'écran.
 */
export function fill(color: string): string {
  if (color === 'transparent') return 'transparent'
  return `color-mix(in oklab, ${color} var(--fill-amount), var(--fill-into))`
}

function Block({
  interval,
  day,
  band,
  className,
  style,
}: {
  interval: Interval
  day: DayView
  band: Band
  className: string
  style?: React.CSSProperties
}) {
  const position = bandPosition(interval, day.start, band)
  if (!position) return null

  return (
    <div
      className={className}
      style={{ left: `${position.left}%`, width: `${position.width}%`, ...style }}
    />
  )
}
