import type { Metadata } from 'next'
import Link from 'next/link'

import { Fab, NavSpacer } from '@/components/Fab'
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/Icons'
import {
  WEEK_BAND,
  computeBand,
  hourOf,
  loadAgenda,
  occupancy,
  splitDays,
  type Band,
  type DayView,
} from '@/lib/agenda'
import {
  addDays,
  addMonths,
  isoDay,
  monthGrid,
  monthName,
  parseIsoDay,
  sameDay,
  startOfMonth,
  wall,
} from '@/lib/dates'
import { clip, minutes } from '@/lib/intervals'
import { requireSpace } from '@/lib/space'
import type { Space } from '@/lib/types'
import { AgendaTabs } from '../AgendaTabs'
import styles from '../agenda.module.css'

export const metadata: Metadata = { title: 'Mois' }

/** Une journée est « ouverte » s'il reste au moins ça de libre à deux. */
const OPEN_DAY_MINUTES = 240

const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default async function MoisPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>
}) {
  const space = await requireSpace()
  const { mois } = await searchParams

  const now = new Date()
  const month = startOfMonth(parseIsoDay(mois) ?? now)
  const cells = monthGrid(month)

  const agenda = await loadAgenda(space, cells[0], addDays(cells[cells.length - 1], 1))
  const days = splitDays(agenda, cells)
  // Même bande pour les 35 cases : la densité reste comparable.
  const band = computeBand(days, WEEK_BAND)

  const openDays = days.filter(
    (day) => inMonth(day, month) && freeInBand(day, band) >= OPEN_DAY_MINUTES,
  ).length

  return (
    <div className="screen">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className="eyebrow">{wall(month).year}</div>
          <h1 className={`display ${styles.title}`}>{monthName(month)}</h1>
        </div>
        <div className={styles.headerActions}>
          <Link
            href={`/agenda/mois?mois=${isoDay(addMonths(month, -1))}`}
            className="btnIcon"
            aria-label="Mois précédent"
          >
            <ChevronLeftIcon size={15} color="var(--ink)" />
          </Link>
          <Link
            href={`/agenda/mois?mois=${isoDay(addMonths(month, 1))}`}
            className="btnIcon"
            aria-label="Mois suivant"
          >
            <ChevronRightIcon size={15} color="var(--ink)" />
          </Link>
        </div>
      </div>

      <AgendaTabs active="mois" date={month} />

      <div className={styles.monthHead} aria-hidden="true">
        {WEEKDAY_INITIALS.map((letter, i) => (
          <div key={i} className={styles.monthHeadCell}>
            {letter}
          </div>
        ))}
      </div>

      <div className={styles.monthGrid}>
        {days.map((day) => (
          <MonthCell
            key={day.start.toISOString()}
            day={day}
            month={month}
            space={space}
            today={now}
            band={band}
          />
        ))}
      </div>

      <div className={styles.legend} style={{ paddingTop: 16 }}>
        <div className={styles.legendItem}>
          <span
            className={styles.legendRibbon}
            style={{ background: space.me.color, height: 4 }}
          />
          Ton taux d'occupation
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendRibbon}
            style={{
              background: space.partner?.color ?? 'var(--border-strong)',
              height: 4,
            }}
          />
          Le sien
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendBlock}
            style={{ background: 'var(--honey)', width: 10 }}
          />
          Journée ouverte à deux
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendBlock}
            style={{ background: 'var(--ink-strong)', width: 8, borderRadius: '50%' }}
          />
          Un truc prévu ensemble
        </div>
      </div>

      <div className={styles.monthSummary}>
        <div>
          <div className={styles.monthSummaryTitle}>
            {openDays} journée{openDays > 1 ? 's' : ''} ouverte
            {openDays > 1 ? 's' : ''}
          </div>
          <div className={styles.monthSummaryMeta}>
            où vous êtes libres tous les deux
          </div>
        </div>
        <div className={styles.roundBadge}>
          <ArrowRightIcon size={19} color="var(--honey-ink)" width={2.2} />
        </div>
      </div>

      <div className={styles.spacer} />
      <NavSpacer />
      <Fab href={`/agenda/evenement?date=${isoDay(month)}`} label="Ajouter un événement" />
    </div>
  )
}

function MonthCell({
  day,
  month,
  space,
  today,
  band,
}: {
  day: DayView
  month: Date
  space: Space
  today: Date
  band: Band
}) {
  const out = !inMonth(day, month)
  const isToday = sameDay(day.start, today)
  const open = !out && freeInBand(day, band) >= OPEN_DAY_MINUTES
  const hasEvent = day.events.length > 0

  const mine = occupancy(day.mine, day.start, band)
  const theirs = occupancy(day.theirs, day.start, band)

  return (
    <Link
      href={`/agenda/jour?date=${isoDay(day.start)}`}
      className={[
        styles.monthCell,
        open ? styles.monthCellOpen : '',
        out ? styles.monthCellOut : '',
        isToday ? styles.monthCellToday : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          styles.monthNumber,
          out ? styles.monthNumberOut : '',
          isToday ? styles.monthNumberToday : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {wall(day.start).day}
      </div>

      <div className={styles.monthBars}>
        <div className={styles.monthTrack}>
          <div
            className={styles.monthFill}
            style={{
              width: `${Math.round(mine * 100)}%`,
              background: out ? 'var(--track-out)' : space.me.color,
            }}
          />
        </div>
        <div className={styles.monthTrack}>
          <div
            className={styles.monthFill}
            style={{
              width: `${Math.round(theirs * 100)}%`,
              background: out ? 'var(--track-out)' : space.partner?.color ?? 'transparent',
            }}
          />
        </div>
      </div>

      {hasEvent && <div className={styles.monthDot} />}
    </Link>
  )
}

function inMonth(day: DayView, month: Date): boolean {
  return wall(day.start).month === wall(month).month
}

/** Minutes libres à deux dans la plage affichée. */
function freeInBand(day: DayView, band: Band): number {
  return clip(
    day.free,
    hourOf(day.start, band.from),
    hourOf(day.start, band.to),
  ).reduce((sum, f) => sum + minutes(f), 0)
}
