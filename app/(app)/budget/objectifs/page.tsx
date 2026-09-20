import type { Metadata } from 'next'
import Link from 'next/link'

import { NavSpacer } from '@/components/Fab'
import { ChevronLeftIcon, TrashIcon } from '@/components/Icons'
import { removeGoal, toggleHold } from '@/lib/actions/goals'
import { shortDate } from '@/lib/dates'
import { statusOf, type Goal } from '@/lib/goals'
import { euros, roundedEuros } from '@/lib/money'
import { currentSpace, requireBudget, requireUser } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import { AddGoalForm, SavedForm } from './GoalForms'
import styles from './objectifs.module.css'

export const metadata: Metadata = { title: 'Objectifs' }

export default async function ObjectifsPage() {
  await requireBudget()
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data, error }, space] = await Promise.all([
    supabase
      .from('savings_goals')
      .select('id, user_id, group_id, label, target_cents, saved_cents, target_on, hold_in_budget')
      .order('target_on'),
    currentSpace(),
  ])

  // Tant que migrations/005 n'a pas été exécutée, la table n'existe pas.
  // Sans ce garde-fou, l'écran s'afficherait vide sans qu'on sache pourquoi.
  const missing = error?.code === 'PGRST205' || error?.code === '42P01'
  const goals = (data ?? []) as Goal[]
  const now = new Date()
  const statuses = goals.map((g) => statusOf(g, now))

  return (
    <div className={`screen ${styles.screen}`}>
      <div className={styles.bar}>
        <Link href="/budget" className="backLink" aria-label="Retour au budget">
          <ChevronLeftIcon size={19} color="var(--ink)" />
        </Link>
      </div>

      <div className={styles.titleZone}>
        <h1 className={`display ${styles.title}`}>Objectifs</h1>
        <p className={styles.lede}>
          Dis combien et pour quand. L'app en déduit ce qu'il faut mettre de
          côté chaque mois, et le retient sur ton reste à vivre.
        </p>
      </div>

      {missing && (
        <div className={styles.section}>
          <div className="noticeBox" role="status">
            La table des objectifs n'existe pas encore. Exécute
            <code> migrations/005-objectifs.sql</code> dans Supabase → SQL
            Editor, puis recharge cette page.
          </div>
        </div>
      )}

      {statuses.map((s) => {
        const mine = s.goal.user_id === user.id
        return (
          <section key={s.goal.id} className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardLabel}>
                {s.goal.label}
                {s.shared && <span className={styles.badge}>à deux</span>}
              </div>
              {mine && (
                <form action={removeGoal}>
                  <input type="hidden" name="id" value={s.goal.id} />
                  <button
                    type="submit"
                    className={styles.iconButton}
                    aria-label={`Supprimer ${s.goal.label}`}
                  >
                    <TrashIcon size={16} color="var(--ink-soft)" />
                  </button>
                </form>
              )}
            </div>

            <div className={styles.amounts}>
              <span className={styles.saved}>{euros(s.goal.saved_cents)}</span>
              <span className={styles.target}>
                sur {roundedEuros(s.goal.target_cents)}
              </span>
            </div>

            <div className={styles.gauge}>
              <div
                className={`${styles.gaugeFill} ${s.late ? styles.gaugeLate : ''}`}
                style={{ width: `${Math.round(s.ratio * 100)}%` }}
              />
            </div>

            <div className={styles.meta}>
              {s.done ? (
                <strong>Atteint</strong>
              ) : s.late ? (
                <>
                  <strong>Échéance dépassée</strong> — il manque{' '}
                  {euros(s.remainingCents)}
                </>
              ) : (
                <>
                  <strong>{euros(s.shareCents)} par mois</strong> ·{' '}
                  {s.monthsLeft} mois d'ici le {shortDate(new Date(`${s.goal.target_on}T12:00:00Z`))}
                  {s.shared && ' · ta moitié'}
                </>
              )}
            </div>

            <SavedForm id={s.goal.id} current={s.goal.saved_cents} />

            {!s.done && !s.late && (
              <form action={toggleHold} className={styles.holdRow}>
                <input type="hidden" name="id" value={s.goal.id} />
                <label className={styles.hold}>
                  <input
                    type="checkbox"
                    name="hold"
                    defaultChecked={s.goal.hold_in_budget}
                    className={styles.checkbox}
                  />
                  Retirer de mon reste à vivre
                </label>
                <button type="submit" className={styles.smallButton}>
                  Appliquer
                </button>
              </form>
            )}
          </section>
        )
      })}

      {!missing && statuses.length === 0 && (
        <div className={styles.section}>
          <p className={styles.help}>
            Aucun objectif pour l'instant.
          </p>
        </div>
      )}

      <AddGoalForm canShare={space !== null} />
      <NavSpacer />
    </div>
  )
}
