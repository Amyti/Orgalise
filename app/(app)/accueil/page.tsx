import type { Metadata } from 'next'
import Link from 'next/link'

import { Strip } from '@/components/agenda/Strip'
import { Avatars } from '@/components/Avatars'
import { Fab, NavSpacer } from '@/components/Fab'
import { ArrowRightIcon, CalendarIcon, WalletIcon } from '@/components/Icons'
import {
  WEEK_BAND,
  MIN_FREE_MINUTES,
  bandTicks,
  computeBand,
  hourOf,
  loadAgenda,
  nextEvent,
  splitDays,
  type DayView,
} from '@/lib/agenda'
import { loadMonth } from '@/lib/budget'
import {
  addDays,
  clock,
  dayShort,
  duration,
  isoDay,
  longDate,
  relative,
  sameDay,
  startOfDay,
  timeRange,
  wall,
  weekDays,
} from '@/lib/dates'
import { atLeast, clip, minutes } from '@/lib/intervals'
import { euros } from '@/lib/money'
import { currentProfile, requireSpace } from '@/lib/space'

import styles from './accueil.module.css'

export const metadata: Metadata = { title: 'Accueil' }

/**
 * Une soirée compte comme libre à partir de deux heures à deux après 18 h.
 *
 * Ces bornes sont volontairement fixes, indépendantes de la bande
 * d'affichage : « soirée » est une notion humaine, elle ne s'étend pas
 * parce que quelqu'un travaille à 5 h du matin.
 */
const EVENING_FROM = 18
const EVENING_TO = 23
const EVENING_MIN_MINUTES = 120

export default async function AccueilPage() {
  const space = await requireSpace()
  const profile = await currentProfile()
  const withBudget = profile?.modules.budget ?? true
  const now = new Date()

  const days = weekDays(now)
  const windowStart = startOfDay(now) < days[0] ? startOfDay(now) : days[0]

  // Sans le module budget, on n'interroge même pas ses tables.
  const [agenda, budget] = await Promise.all([
    loadAgenda(space, windowStart, addDays(days[6], 1)),
    withBudget ? loadMonth(now) : null,
  ])

  const views = splitDays(agenda, days)
  const today = views.find((d) => sameDay(d.start, now)) ?? views[0]
  // La bande de la journée affichée, étendue à ce qu'elle contient.
  const band = computeBand([today], WEEK_BAND)
  const next = nextEvent(agenda, now)

  const todaySlots = atLeast(
    clip(today.free, hourOf(today.start, band.from), hourOf(today.start, band.to)),
    MIN_FREE_MINUTES,
  )
    .sort((a, b) => minutes(b) - minutes(a))
    .slice(0, 2)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const freeEvenings = views.filter(
    (day) => day.start >= startOfDay(now) && hasFreeEvening(day),
  ).length

  const upcoming = agenda.events.filter((o) => o.end > now).slice(0, 3)

  return (
    <div className="screen">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className="eyebrow">{longDate(now)}</div>
          <h1 className={`display ${styles.title}`}>
            {space.partner ? 'Salut vous deux' : `Salut ${space.me.display_name}`}
          </h1>
        </div>
        <Avatars space={space} />
      </div>

      {/* --- Aujourd'hui ------------------------------------------------ */}
      <section className={styles.today}>
        <div className={styles.todayHead}>
          <h2 className={styles.todayTitle}>Aujourd'hui</h2>
          <Link href={`/agenda/jour?date=${isoDay(now)}`} className={styles.detail}>
            Détail
          </Link>
        </div>

        <Strip
          day={today}
          band={band}
          height={34}
          inset={5}
          bare
          colors={{
            mine: space.me.color,
            theirs: space.partner?.color ?? 'transparent',
          }}
        />

        {/* Repères calés sur la bande : ils suivent quand elle s'étend. */}
        <div className={styles.hours} aria-hidden="true">
          {bandTicks(band, 4).map((h) => (
            <span key={h}>{h} h</span>
          ))}
        </div>

        {todaySlots.length > 0 ? (
          <div className={styles.chips}>
            {todaySlots.map((slot) => (
              <div key={slot.start.toISOString()} className={styles.chip}>
                <div className={styles.chipTime}>
                  {slot.end >= hourOf(today.start, band.to)
                    ? `dès ${clock(slot.start)}`
                    : timeRange(slot.start, slot.end)}
                </div>
                <div className={styles.chipMeta}>
                  {duration(minutes(slot))} libre{space.partner ? ' à deux' : ''}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.chips}>
            <div className={styles.chip} style={{ background: 'var(--ground)' }}>
              <div className={styles.chipTime} style={{ fontSize: 14 }}>
                Journée pleine
              </div>
              <div className={styles.chipMeta} style={{ color: 'var(--ink-soft)' }}>
                aucun creux commun
              </div>
            </div>
          </div>
        )}
      </section>

      {/* --- Prochain truc à deux --------------------------------------- */}
      {next ? (
        <Link
          href={`/agenda/evenement?id=${next.event.id}&occurrence=${next.start.toISOString()}`}
          className={styles.next}
        >
          <div className={styles.nextMain}>
            <div className={styles.nextTag}>
              <span className={styles.nextTagDot} />
              <span className={styles.nextTagText}>PROCHAIN TRUC À DEUX</span>
            </div>
            <div className={styles.nextTitle}>{next.event.title}</div>
            <div className={styles.nextMeta}>
              {whenLabel(next.start, now)} · {relative(next.start, now)}
            </div>
          </div>
          <div className={styles.nextBadge}>
            <ArrowRightIcon size={19} color="var(--honey-ink)" width={2.2} />
          </div>
        </Link>
      ) : (
        <Link href="/agenda/evenement" className={styles.next}>
          <div className={styles.nextMain}>
            <div className={styles.nextTag}>
              <span className={styles.nextTagDot} />
              <span className={styles.nextTagText}>RIEN DE PRÉVU</span>
            </div>
            <div className={styles.nextTitle}>Caler quelque chose</div>
            <div className={styles.nextMeta}>
              Vos creux communs sont dans l'agenda.
            </div>
          </div>
          <div className={styles.nextBadge}>
            <ArrowRightIcon size={19} color="var(--honey-ink)" width={2.2} />
          </div>
        </Link>
      )}

      {/* --- Deux chiffres ---------------------------------------------- */}
      <div className={styles.stats}>
        <Link href="/agenda" className={styles.stat}>
          <CalendarIcon size={20} color="var(--user-a-line)" width={1.9} />
          <div>
            <div className={styles.statValue}>{freeEvenings}</div>
            <div className={styles.statLabel}>
              soirée{freeEvenings > 1 ? 's' : ''} libre{freeEvenings > 1 ? 's' : ''}
              <br />
              cette semaine
            </div>
          </div>
        </Link>

        {budget && (
          <Link href="/budget" className={styles.stat}>
            <WalletIcon size={20} color="var(--user-b-line)" width={1.9} />
            <div>
              <div className={styles.statValue}>
                {budget.remainingCents === null
                  ? euros(budget.totalCents)
                  : euros(budget.remainingCents)}
              </div>
              <div className={styles.statLabel}>
                {budget.remainingCents === null ? (
                  <>
                    dépensés
                    <br />
                    ce mois-ci
                  </>
                ) : (
                  <>
                    restants sur
                    <br />
                    ton budget
                  </>
                )}
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* --- Cette semaine ---------------------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="sectionTitle">Cette semaine</h2>
        </div>

        {upcoming.length > 0 ? (
          <div className="list">
            {upcoming.map((occurrence) => (
              <Link
                key={`${occurrence.event.id}-${occurrence.start.toISOString()}`}
                href={`/agenda/jour?date=${isoDay(occurrence.start)}`}
                className={styles.upcoming}
              >
                <div className={styles.upcomingStamp}>
                  <div className={styles.upcomingDow}>{dayShort(occurrence.start)}</div>
                  <div className={styles.upcomingDay}>{wall(occurrence.start).day}</div>
                </div>
                <div className={styles.upcomingMain}>
                  <div className={styles.upcomingTitle}>{occurrence.event.title}</div>
                  <div className={styles.upcomingMeta}>
                    {timeRange(occurrence.start, occurrence.end)} · à deux
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="list">
            <div className="empty">
              Rien de commun d'ici dimanche.
              <br />
              Le « + » en bas à droite règle ça.
            </div>
          </div>
        )}
      </section>

      <div className={styles.spacer} />
      <NavSpacer />
      <Fab href={`/agenda/evenement?date=${isoDay(now)}`} label="Ajouter un événement" />
    </div>
  )
}

function hasFreeEvening(day: DayView): boolean {
  const evening = clip(
    day.free,
    hourOf(day.start, EVENING_FROM),
    hourOf(day.start, EVENING_TO),
  )
  return atLeast(evening, EVENING_MIN_MINUTES).length > 0
}

function whenLabel(date: Date, now: Date): string {
  if (sameDay(date, now)) return `Ce soir, ${clock(date)}`
  if (sameDay(date, addDays(now, 1))) return `Demain, ${clock(date)}`
  return `${longDate(date)}, ${clock(date)}`
}
