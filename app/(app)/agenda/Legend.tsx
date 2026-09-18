import type { Space } from '@/lib/types'
import styles from './agenda.module.css'

/**
 * La légende n'est pas décorative : c'est elle qui apprend la grammaire
 * visuelle utilisée sur les trois vues.
 */
export function Legend({ space }: { space: Space }) {
  const { me, partner } = space

  return (
    <div className={styles.legend}>
      <div className={styles.legendItem}>
        <span className={styles.legendRibbon} style={{ background: me.color }} />
        {me.display_name}
      </div>
      {partner && (
        <div className={styles.legendItem}>
          <span
            className={styles.legendRibbon}
            style={{ background: partner.color }}
          />
          {partner.display_name}
        </div>
      )}
      <div className={styles.legendItem}>
        <span className={styles.legendBlock} style={{ background: 'var(--honey)' }} />
        Libres
      </div>
      <div className={styles.legendItem}>
        <span
          className={styles.legendBlock}
          style={{ background: 'var(--ink-strong)' }}
        />
        À deux
      </div>
    </div>
  )
}
