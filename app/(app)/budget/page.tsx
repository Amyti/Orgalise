import type { Metadata } from 'next'
import Link from 'next/link'

import { Fab, NavSpacer } from '@/components/Fab'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/Icons'
import { loadDashboard, monthlyTrend } from '@/lib/budget'
import {
  addMonths,
  dayLabel,
  isoDay,
  monthName,
  monthShort,
  parseIsoDay,
  startOfMonth,
  wall,
} from '@/lib/dates'
import { forecastMonth, remaining, upcoming, type Occurrence } from '@/lib/forecast'
import { declaredByGoal, heldCents, statusOf } from '@/lib/goals'
import { euros, roundedEuros } from '@/lib/money'
import { requireBudget } from '@/lib/space'
import { LimitForm } from './LimitForm'
import styles from './budget.module.css'

export const metadata: Metadata = { title: 'Budget' }

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>
}) {
  await requireBudget()
  const { mois } = await searchParams

  const now = new Date()
  const month = startOfMonth(parseIsoDay(mois) ?? now)
  const { budget, incomes, fixed, planned, history, goals, savings } =
    await loadDashboard(month)

  /*
   * Trois choses s'enchaînent ici. Ce qu'on a déclaré verser à chaque
   * objectif, l'état de chaque objectif à la lumière de ce versement, et
   * enfin ce que les objectifs SANS versement déclaré retiennent
   * d'office. L'épargne déclarée, elle, sort de l'enveloppe par la
   * projection normale des règles.
   */
  const declared = declaredByGoal(savings)
  const statuses = goals.map((g) => statusOf(g, now, declared.get(g.id) ?? 0))
  const held = heldCents(statuses)

  const forecast = forecastMonth(month, incomes, fixed, planned, savings, held)
  const planned2 = [1, 2].map((offset) =>
    forecastMonth(addMonths(month, offset), incomes, fixed, planned, savings, held),
  )

  // Les dépenses prévues déjà pointées ont créé une vraie dépense : elles
  // sont dans `budget.totalCents`, il ne faut pas les recompter.
  const left = remaining(forecast, budget.totalCents, now)
  const configured = incomes.length > 0

  const trend = monthlyTrend(history, month)
  const peak = Math.max(...trend.map((t) => t.cents), 1)

  const next = upcoming([forecast, ...planned2], now, 4)

  // Sans prévisionnel, on retombe sur le plafond manuel.
  const over = configured
    ? left.cents < 0
    : budget.remainingCents !== null && budget.remainingCents < 0
  const ratio = configured
    ? forecast.envelopeCents > 0
      ? budget.totalCents / forecast.envelopeCents
      : null
    : budget.ratio

  return (
    <div className="screen">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className="eyebrow">Mon budget</div>
          <h1 className={`display ${styles.title}`}>
            {monthName(month)}
            {wall(month).year !== wall(now).year ? ` ${wall(month).year}` : ''}
          </h1>
        </div>
        <div className={styles.headerActions}>
          <Link
            href={`/budget?mois=${isoDay(addMonths(month, -1))}`}
            className="btnIcon"
            aria-label="Mois précédent"
          >
            <ChevronLeftIcon size={14} color="var(--ink)" />
          </Link>
          <Link
            href={`/budget?mois=${isoDay(addMonths(month, 1))}`}
            className="btnIcon"
            aria-label="Mois suivant"
          >
            <ChevronRightIcon size={14} color="var(--ink)" />
          </Link>
        </div>
      </div>

      {configured ? (
        <>
          {/* --- Le chiffre qui compte --------------------------------- */}
          <section className={styles.living}>
            <div className={styles.livingHead}>
              <div>
                <div className={styles.livingLabel}>
                  {left.cents < 0 ? 'Dépassement' : 'Reste à vivre'}
                </div>
                <div
                  className={`${styles.livingValue} ${left.cents < 0 ? styles.livingNegative : ''}`}
                >
                  {euros(Math.abs(left.cents))}
                </div>
              </div>
              {left.cents > 0 && (
                <div className={styles.livingPerDay}>
                  <div className={styles.livingPerDayValue}>
                    {euros(left.perDayCents)}
                  </div>
                  <div className={styles.livingPerDayLabel}>
                    par jour · {left.days} jour{left.days > 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Le calcul à plat : chaque ligne explique celle du dessus. */}
            <dl className={styles.ledger}>
              <div className={styles.ledgerRow}>
                <dt>Revenus</dt>
                <dd>{euros(forecast.incomeCents)}</dd>
              </div>
              <div className={styles.ledgerRow}>
                <dt>Charges fixes</dt>
                <dd>−{euros(forecast.fixedCents)}</dd>
              </div>
              {forecast.plannedPendingCents > 0 && (
                <div className={styles.ledgerRow}>
                  <dt>Prévu, pas encore payé</dt>
                  <dd>−{euros(forecast.plannedPendingCents)}</dd>
                </div>
              )}
              {forecast.savingsCents > 0 && (
                <div className={styles.ledgerRow}>
                  <dt>Mis de côté</dt>
                  <dd>−{euros(forecast.savingsCents)}</dd>
                </div>
              )}
              <div className={`${styles.ledgerRow} ${styles.ledgerTotal}`}>
                <dt>Enveloppe du mois</dt>
                <dd>{euros(forecast.envelopeCents)}</dd>
              </div>
              <div className={styles.ledgerRow}>
                <dt>Déjà dépensé</dt>
                <dd>−{euros(budget.totalCents)}</dd>
              </div>
            </dl>

            {ratio !== null && (
              <>
                <div className={styles.gauge}>
                  <div
                    className={`${styles.gaugeFill} ${over ? styles.gaugeOver : ''}`}
                    style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                  />
                </div>
                <div className={styles.gaugeMeta}>
                  <span>{Math.round(ratio * 100)} % de l'enveloppe</span>
                  <Link href="/budget/plan" className={styles.limitButton}>
                    Modifier le prévisionnel
                  </Link>
                </div>
              </>
            )}
          </section>

          <GoalsCard statuses={statuses} />
        </>
      ) : (
        <>
          {/* --- Repli : le plafond manuel ----------------------------- */}
          <section className={styles.total}>
            <div className={styles.totalRow}>
              <div>
                <div className={styles.totalLabel}>Dépensé</div>
                <div className={styles.totalValue}>{euros(budget.totalCents)}</div>
              </div>
              {budget.remainingCents !== null && (
                <div className={styles.totalRight}>
                  <div
                    className={`${styles.totalRemaining} ${over ? styles.totalRemainingOver : ''}`}
                  >
                    {euros(Math.abs(budget.remainingCents))}
                  </div>
                  <div className={styles.totalRemainingLabel}>
                    {over ? 'de dépassement' : 'restants'}
                  </div>
                </div>
              )}
            </div>

            {budget.ratio !== null && (
              <div className={styles.gauge}>
                <div
                  className={`${styles.gaugeFill} ${over ? styles.gaugeOver : ''}`}
                  style={{ width: `${Math.min(100, Math.round(budget.ratio * 100))}%` }}
                />
              </div>
            )}

            <div className={styles.gaugeMeta}>
              <span>
                {budget.ratio === null
                  ? `${budget.expenses.length} dépense${budget.expenses.length > 1 ? 's' : ''}`
                  : `${Math.round(budget.ratio * 100)} % du budget`}
              </span>
              <LimitForm
                monthIso={isoDay(month)}
                current={budget.limitCents === null ? '' : roundedEuros(budget.limitCents)}
              />
            </div>
          </section>

          <section className={styles.setup}>
            <div className={styles.setupTitle}>Prévoir le mois</div>
            <div className={styles.setupBody}>
              Entre ton salaire et tes charges fixes : l'app calcule ce qu'il
              te reste vraiment à dépenser, et par jour.
            </div>
            <Link href="/budget/plan" className={styles.setupLink}>
              Configurer
            </Link>
          </section>
        </>
      )}

      {/* --- Tendance sur six mois ------------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">Six derniers mois</h2>
          <div className={styles.sectionMeta}>
            {euros(Math.round(trend.reduce((s, t) => s + t.cents, 0) / trend.length))} en
            moyenne
          </div>
        </div>

        <div className={styles.trend}>
          {trend.map((point) => {
            const current = isoDay(point.month) === isoDay(month)
            return (
              <Link
                key={isoDay(point.month)}
                href={`/budget?mois=${isoDay(point.month)}`}
                className={styles.trendCol}
              >
                <div className={styles.trendAmount}>
                  {point.cents > 0 ? roundedEuros(point.cents) : '—'}
                </div>
                <div
                  className={`${styles.trendBar} ${current ? styles.trendBarOn : ''}`}
                  style={{ height: `${Math.max(4, (point.cents / peak) * 56)}px` }}
                />
                <div className={styles.trendLabel}>{monthShort(point.month)}</div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* --- Échéances à venir ----------------------------------------- */}
      {next.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className="sectionTitle">À venir</h2>
            <Link href="/budget/plan" className={styles.planLink}>
              Gérer
            </Link>
          </div>

          <div className="list">
            {next.map((occurrence) => (
              <DueRow key={`${occurrence.kind}-${occurrence.id}-${occurrence.on.toISOString()}`} occurrence={occurrence} />
            ))}
          </div>
        </section>
      )}

      {/* --- Par catégorie --------------------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">Par catégorie</h2>
          <div className={styles.sectionMeta}>
            {budget.totals.length} poste{budget.totals.length > 1 ? 's' : ''}
          </div>
        </div>

        {budget.totals.length > 0 ? (
          <>
            <div className={styles.bar}>
              {budget.totals.map((total) => (
                <div
                  key={total.category.id}
                  className={styles.barSegment}
                  style={{ flexGrow: total.share, background: total.category.color }}
                />
              ))}
            </div>

            <div className={styles.catGrid}>
              {budget.totals.map((total) => (
                <div key={total.category.id} className={styles.catCard}>
                  <div className={styles.catHead}>
                    <span
                      className={styles.catDot}
                      style={{ background: total.category.color }}
                    />
                    <span className={styles.catName}>{total.category.name}</span>
                  </div>
                  <div className={styles.catFoot}>
                    <span className={styles.catAmount}>{euros(total.cents)}</span>
                    <span className={styles.catShare}>{Math.round(total.share)} %</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="list">
            <div className="empty">
              Aucune dépense en {monthName(month)}.
              <br />
              Le « + » en bas à droite ouvre la saisie.
            </div>
          </div>
        )}
      </section>

      {/* --- Dernières dépenses ---------------------------------------- */}
      {budget.expenses.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className="sectionTitle">Dernières dépenses</h2>
            <Link href={`/budget/tableau?mois=${isoDay(month)}`} className={styles.linkAll}>
              Tout voir
            </Link>
          </div>

          <div className="list">
            {budget.expenses.slice(0, 3).map((expense) => {
              const category = expense.category_id
                ? budget.byId.get(expense.category_id)
                : undefined
              return (
                <Link
                  key={expense.id}
                  href={`/budget/tableau?mois=${isoDay(month)}`}
                  className={styles.expenseRow}
                >
                  <span
                    className={styles.catDot}
                    style={{ background: category?.color ?? 'var(--cat-autre)' }}
                  />
                  <div className={styles.expenseMain}>
                    <div className={styles.expenseLabel}>{expense.label}</div>
                    <div className={styles.expenseMeta}>
                      {dayLabel(parseIsoDay(expense.spent_on) ?? now, now)}
                      {category ? ` · ${category.name}` : ''}
                    </div>
                  </div>
                  <div className={styles.expenseAmount}>{euros(expense.amount_cents)}</div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <div className={styles.spacer} />
      <NavSpacer />
      <Fab href={`/budget/ajout?date=${isoDay(now)}`} label="Ajouter une dépense" />
    </div>
  )
}

function DueRow({ occurrence }: { occurrence: Occurrence }) {
  const w = wall(occurrence.on)
  return (
    <div className={styles.dueRow}>
      <div className={styles.dueStamp}>
        <div className={styles.dueDay}>{w.day}</div>
        <div className={styles.dueMonth}>{monthShort(occurrence.on)}</div>
      </div>
      <div className={styles.dueMain}>
        <div className={styles.dueLabel}>{occurrence.label}</div>
        <div className={styles.dueKind}>
          {occurrence.kind === 'fixed' ? 'Charge fixe' : 'Prévu'}
        </div>
      </div>
      <div className={styles.dueAmount}>{euros(occurrence.amountCents)}</div>
    </div>
  )
}

/**
 * Les objectifs, vus du tableau de bord.
 *
 * On montre le plus proche dans le temps, parce que c'est celui qui
 * contraint le mois en cours. Le reste tient dans un lien.
 */
function GoalsCard({ statuses }: { statuses: ReturnType<typeof statusOf>[] }) {
  if (statuses.length === 0) {
    return (
      <section className={styles.goalsEmpty}>
        <div>
          <div className={styles.goalsEmptyTitle}>Un objectif d'épargne&nbsp;?</div>
          <p className={styles.goalsEmptyText}>
            Dis combien et pour quand, l'app calcule ce qu'il faut mettre de
            côté chaque mois.
          </p>
        </div>
        <Link href="/budget/objectifs" className={styles.limitButton}>
          En créer un
        </Link>
      </section>
    )
  }

  const sorted = [...statuses].sort(
    (a, b) => a.goal.target_on.localeCompare(b.goal.target_on),
  )
  const first = sorted.find((s) => !s.done) ?? sorted[0]
  const others = sorted.length - 1

  return (
    <section className={styles.goals}>
      <div className={styles.goalsHead}>
        <h2 className="sectionTitle">Objectifs</h2>
        <Link href="/budget/objectifs" className={styles.limitButton}>
          {others > 0 ? `Voir les ${sorted.length}` : 'Gérer'}
        </Link>
      </div>

      <div className={styles.goalRow}>
        <div className={styles.goalTop}>
          <span className={styles.goalLabel}>
            {first.goal.label}
            {first.shared && <span className={styles.goalShared}>à deux</span>}
          </span>
          <span className={styles.goalAmount}>
            {euros(first.goal.saved_cents)} / {roundedEuros(first.goal.target_cents)}
          </span>
        </div>

        <div className={styles.gauge}>
          <div
            className={styles.gaugeFill}
            style={{ width: `${Math.round(first.ratio * 100)}%` }}
          />
        </div>

        <div className={styles.goalMeta}>
          {first.done
            ? 'Atteint'
            : first.late
              ? 'Échéance dépassée'
              : `${euros(first.shareCents)} par mois · ${first.monthsLeft} mois restants`}
        </div>
      </div>
    </section>
  )
}
