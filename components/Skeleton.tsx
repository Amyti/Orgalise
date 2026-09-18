import styles from './skeleton.module.css'

/**
 * Silhouette affichée pendant qu'un écran charge.
 *
 * Elle ne sert pas qu'à décorer : sa seule présence permet à Next de
 * précharger la coque d'une route dynamique quand le lien entre dans le
 * champ. Sans `loading.tsx`, un tap laisse l'écran figé le temps de
 * l'aller-retour serveur — c'est ce qui donnait cette impression de
 * lenteur.
 */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="screen" aria-busy="true" aria-live="polite">
      <span className="srOnly">Chargement…</span>

      <div className={styles.header}>
        <div className={styles.bar} style={{ width: 110, height: 11 }} />
        <div className={styles.bar} style={{ width: 190, height: 27, marginTop: 8 }} />
      </div>

      <div className={styles.card} />

      <div className={styles.list}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={styles.row}>
            <div className={styles.stamp} />
            <div className={styles.rowBody}>
              <div className={styles.bar} style={{ height: 28 }} />
              <div className={styles.bar} style={{ width: '55%', height: 9, marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
