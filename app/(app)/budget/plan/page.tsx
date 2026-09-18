import type { Metadata } from 'next'
import Link from 'next/link'

import { NavSpacer } from '@/components/Fab'
import { CheckIcon, ChevronLeftIcon, TrashIcon } from '@/components/Icons'
import {
  removeFixedCharge,
  removeIncome,
  removePlanned,
  settlePlanned,
} from '@/lib/actions/plan'
import { isoDay, monthName, shortDate, startOfMonth } from '@/lib/dates'
import { euros } from '@/lib/money'
import { requireBudget } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import { withPaletteColors } from '@/lib/categories'
import type { Category } from '@/lib/types'
import type { FixedCharge, Income, PlannedExpense } from '@/lib/forecast'
import { PlanForm } from './PlanForms'
import styles from './plan.module.css'

export const metadata: Metadata = { title: 'Prévisionnel' }

export default async function PlanPage() {
  await requireBudget()
  const supabase = await createClient()
  const today = new Date()

  const [incomesQ, fixedQ, plannedQ, { data: categories }] =
    await Promise.all([
      supabase
        .from('incomes')
        .select('id, label, amount_cents, day_of_month, starts_on, ends_on')
        .order('day_of_month'),
      supabase
        .from('fixed_charges')
        .select('id, label, amount_cents, category_id, day_of_month, starts_on, ends_on')
        .order('day_of_month'),
      supabase
        .from('planned_expenses')
        .select('id, label, amount_cents, category_id, due_on, settled_at, expense_id')
        .gte('due_on', isoDay(startOfMonth(today)))
        .order('due_on'),
      supabase.from('categories').select('id, name, color, position').order('position'),
    ])

  // Tant que migrations/002 n'a pas été exécutée, les trois tables
  // n'existent pas. Sans ce garde-fou, l'écran s'afficherait vide et
  // chaque enregistrement échouerait sans qu'on sache pourquoi.
  const missingTables = [incomesQ, fixedQ, plannedQ].some(
    (q) => q.error?.code === 'PGRST205' || q.error?.code === '42P01',
  )

  const incomes = incomesQ.data
  const fixed = fixedQ.data
  const planned = plannedQ.data

  const cats = withPaletteColors((categories ?? []) as Category[])
  const byId = new Map(cats.map((c) => [c.id, c]))

  const incomeList = (incomes ?? []) as Income[]
  const fixedList = (fixed ?? []) as FixedCharge[]
  const plannedList = (planned ?? []) as PlannedExpense[]

  const incomeTotal = incomeList.reduce((t, i) => t + i.amount_cents, 0)
  const fixedTotal = fixedList.reduce((t, f) => t + f.amount_cents, 0)
  const plannedTotal = plannedList
    .filter((p) => !p.settled_at)
    .reduce((t, p) => t + p.amount_cents, 0)

  return (
    <div className="screen">
      <div className={styles.bar}>
        <Link href="/budget" className="backLink" aria-label="Retour">
          <ChevronLeftIcon size={19} color="var(--ink)" />
        </Link>
      </div>

      <div className={styles.titleZone}>
        <h1 className={`display ${styles.title}`}>Prévoir le mois</h1>
        <p className={styles.lede}>
          Ce qui rentre, ce qui part tous les mois, et ce qui tombe bientôt.
          L'app en déduit ce qu'il te reste vraiment à dépenser.
        </p>
      </div>

      {missingTables && (
        <div className={styles.section}>
          <div className="noticeBox">
            Le prévisionnel n'est pas encore activé sur cet espace.
          </div>
        </div>
      )}

      {/* --- Revenus ---------------------------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">Ce qui rentre</h2>
          <div className={styles.sectionTotal}>{euros(incomeTotal)}</div>
        </div>

        <div className="list">
          {incomeList.length > 0 ? (
            incomeList.map((income) => (
              <div key={income.id} className={styles.row}>
                <span className={styles.rowDot} style={{ background: 'var(--user-b)' }} />
                <div className={styles.rowMain}>
                  <div className={styles.rowLabel}>{income.label}</div>
                  <div className={styles.rowMeta}>le {income.day_of_month} du mois</div>
                </div>
                <div className={styles.rowAmount}>{euros(income.amount_cents)}</div>
                <form action={removeIncome} className={styles.rowActions}>
                  <input type="hidden" name="id" value={income.id} />
                  <button
                    type="submit"
                    className={styles.iconButton}
                    aria-label={`Supprimer ${income.label}`}
                  >
                    <TrashIcon size={15} color="var(--ink-soft)" />
                  </button>
                </form>
              </div>
            ))
          ) : (
            <div className="empty">
              Ajoute ton salaire pour que l'app sache de quoi partir.
            </div>
          )}
        </div>

        <PlanForm kind="income" categories={cats} />
      </section>

      {/* --- Charges fixes ---------------------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">Tous les mois</h2>
          <div className={styles.sectionTotal}>{euros(fixedTotal)}</div>
        </div>

        <div className="list">
          {fixedList.length > 0 ? (
            fixedList.map((charge) => {
              const category = charge.category_id ? byId.get(charge.category_id) : undefined
              return (
                <div key={charge.id} className={styles.row}>
                  <span
                    className={styles.rowDot}
                    style={{ background: category?.color ?? 'var(--cat-autre)' }}
                  />
                  <div className={styles.rowMain}>
                    <div className={styles.rowLabel}>{charge.label}</div>
                    <div className={styles.rowMeta}>
                      le {charge.day_of_month}
                      {category ? ` · ${category.name}` : ''}
                    </div>
                  </div>
                  <div className={styles.rowAmount}>{euros(charge.amount_cents)}</div>
                  <form action={removeFixedCharge} className={styles.rowActions}>
                    <input type="hidden" name="id" value={charge.id} />
                    <button
                      type="submit"
                      className={styles.iconButton}
                      aria-label={`Supprimer ${charge.label}`}
                    >
                      <TrashIcon size={15} color="var(--ink-soft)" />
                    </button>
                  </form>
                </div>
              )
            })
          ) : (
            <div className="empty">
              Loyer, assurance, abonnements : ce qui part quoi qu'il arrive.
            </div>
          )}
        </div>

        <PlanForm kind="fixed" categories={cats} />
        <p className={styles.hint}>
          Les charges fixes sont retirées de l'enveloppe du mois, sans que tu
          aies à les saisir en dépense.
        </p>
      </section>

      {/* --- Dépenses prévues -------------------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">À venir, une fois</h2>
          <div className={styles.sectionTotal}>{euros(plannedTotal)}</div>
        </div>

        <div className="list">
          {plannedList.length > 0 ? (
            plannedList.map((item) => {
              const category = item.category_id ? byId.get(item.category_id) : undefined
              const settled = item.settled_at !== null
              return (
                <div
                  key={item.id}
                  className={`${styles.row} ${settled ? styles.rowSettled : ''}`}
                >
                  <span
                    className={styles.rowDot}
                    style={{ background: category?.color ?? 'var(--cat-autre)' }}
                  />
                  <div className={styles.rowMain}>
                    <div className={styles.rowLabel}>{item.label}</div>
                    <div className={styles.rowMeta}>
                      {settled
                        ? 'payé'
                        : `le ${shortDate(new Date(`${item.due_on}T12:00:00Z`))}`}
                      {category ? ` · ${category.name}` : ''}
                    </div>
                  </div>
                  <div className={styles.rowAmount}>{euros(item.amount_cents)}</div>
                  <div className={styles.rowActions}>
                    {!settled && (
                      <form action={settlePlanned}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className={styles.settleButton}>
                          <CheckIcon size={13} color="var(--on-strong)" /> Payé
                        </button>
                      </form>
                    )}
                    <form action={removePlanned}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className={styles.iconButton}
                        aria-label={`Supprimer ${item.label}`}
                      >
                        <TrashIcon size={15} color="var(--ink-soft)" />
                      </button>
                    </form>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="empty">
              Impôts, vacances, cadeau : ce qui tombe une fois et qu'il vaut
              mieux ne pas oublier.
            </div>
          )}
        </div>

        <PlanForm kind="planned" categories={cats} defaultDue={isoDay(today)} />
        <p className={styles.hint}>
          Tant qu'une prévision n'est pas pointée « payé », son montant reste
          mis de côté. En la pointant, l'app crée la dépense réelle en{' '}
          {monthName(today)} — sans jamais compter le montant deux fois.
        </p>
      </section>

      <div className={styles.spacer} />
      <NavSpacer />
    </div>
  )
}
