import type { Metadata } from 'next'
import Link from 'next/link'

import { fill, line } from '@/components/agenda/Strip'
import { Fab, NavSpacer } from '@/components/Fab'
import { ChevronLeftIcon } from '@/components/Icons'
import {
  DAY_BAND,
  MIN_FREE_MINUTES,
  bandHours,
  computeBand,
  hourOf,
  loadAgenda,
  splitDays,
} from '@/lib/agenda'
import {
  addDays,
  dayName,
  duration,
  isoDay,
  parseIsoDay,
  startOfDay,
  timeRange,
  wall,
} from '@/lib/dates'
import { atLeast, clip, minutes, type Interval } from '@/lib/intervals'
import { requireSpace } from '@/lib/space'
import styles from '../agenda.module.css'

export const metadata: Metadata = { title: 'Jour' }

/** Hauteur d'une heure, reprise de la maquette. */
const PX_PER_HOUR = 37

export default async function JourPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const space = await requireSpace()
  const { date } = await searchParams

  const day = startOfDay(parseIsoDay(date) ?? new Date())
  const agenda = await loadAgenda(space, day, addDays(day, 1))
  const [view] = splitDays(agenda, [day])

  // La bande s'étend à ce que la journée contient vraiment : une garde à
  // 5 h doit apparaître, pas être découpée hors de l'écran.
  const band = computeBand([view], DAY_BAND)
  const bandStart = hourOf(day, band.from)
  const bandEnd = hourOf(day, band.to)
  const freeInBand = atLeast(clip(view.free, bandStart, bandEnd), MIN_FREE_MINUTES)
  const freeTotal = freeInBand.reduce((sum, f) => sum + minutes(f), 0)

  const hours = bandHours(band, 2)

  const top = (d: Date) =>
    ((d.getTime() - day.getTime()) / 3_600_000 - band.from) * PX_PER_HOUR
  const height = (i: Interval) =>
    Math.max(
      14,
      ((i.end.getTime() - i.start.getTime()) / 3_600_000) * PX_PER_HOUR,
    )

  return (
    <div className="screen">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Link
            href={`/agenda?semaine=${isoDay(day)}`}
            className="eyebrow"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <ChevronLeftIcon size={12} color="var(--ink-soft)" width={2.4} />
            Semaine
          </Link>
          <h1 className={`display ${styles.title}`}>
            {dayName(day)} {wall(day).day}
          </h1>
        </div>
        <div className={styles.dayHeaderRight}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Libres à deux</div>
          <div className={styles.dayFreeTotal}>
            {freeTotal > 0 ? duration(freeTotal) : '—'}
          </div>
        </div>
      </div>

      <div className={styles.columnsLegend}>
        <div className={styles.columnsLegendSpacer} />
        <div className={styles.columnsLegendItems}>
          <div className={styles.columnsLegendItem}>
            <span
              className={styles.columnsLegendDot}
              style={{ background: space.me.color }}
            />
            <span className={styles.columnsLegendName}>{space.me.display_name}</span>
          </div>
          <div className={styles.columnsLegendItem}>
            <span
              className={styles.columnsLegendDot}
              style={{
                background: space.partner?.color ?? 'var(--border-strong)',
              }}
            />
            <span className={styles.columnsLegendName}>
              {space.partner?.display_name ?? 'En attente'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.dayGrid}>
        <div className={styles.hourGutter} style={{ height: (band.to - band.from) * PX_PER_HOUR }}>
          {hours.map((h) => (
            <div
              key={h}
              className={styles.hourLabel}
              style={{ top: (h - band.from) * PX_PER_HOUR - 7 }}
            >
              {h} h
            </div>
          ))}
        </div>

        <div
          className={styles.dayCanvas}
          style={{ height: (band.to - band.from) * PX_PER_HOUR }}
        >
          {hours.map((h) => (
            <div
              key={h}
              className={styles.hourLine}
              style={{ top: (h - band.from) * PX_PER_HOUR }}
            />
          ))}

          {freeInBand.map((free, i) => (
            <div
              key={`free-${i}`}
              className={styles.dayFree}
              style={{ top: top(free.start), height: height(free) }}
            >
              <span className={styles.dayFreeTag}>{duration(minutes(free))} libre</span>
            </div>
          ))}

          <div className={styles.dayColumns}>
            <BusyColumn
              blocks={clip(view.mine, bandStart, bandEnd)}
              color={space.me.color}
              top={top}
              height={height}
            />
            <BusyColumn
              blocks={clip(view.theirs, bandStart, bandEnd)}
              color={space.partner?.color ?? 'var(--border-strong)'}
              top={top}
              height={height}
            />
          </div>

          {view.events.map((occurrence) => {
            const slot = { start: occurrence.start, end: occurrence.end }
            return (
              <Link
                key={`${occurrence.event.id}-${occurrence.start.toISOString()}`}
                href={`/agenda/evenement?id=${occurrence.event.id}&occurrence=${occurrence.start.toISOString()}`}
                className={styles.dayEvent}
                style={{ top: top(occurrence.start), height: height(slot) }}
              >
                <div className={styles.dayEventTag}>
                  <span className={styles.dayEventTagDot} />
                  <span className={styles.dayEventTagText}>À DEUX</span>
                </div>
                <div className={styles.dayEventTitle}>{occurrence.event.title}</div>
                <div className={styles.dayEventTime}>
                  {timeRange(occurrence.start, occurrence.end)}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className={styles.spacer} />
      <NavSpacer />
      <Fab href={`/agenda/evenement?date=${isoDay(day)}`} label="Ajouter un événement" />
    </div>
  )
}

/**
 * Colonne des plages occupées d'une personne.
 *
 * Pas de titre affiché : on n'en a pas. CLAUDE.md, décision 5 — l'import
 * iCal ne garde que les horaires, jamais le contenu des événements.
 */
function BusyColumn({
  blocks,
  color,
  top,
  height,
}: {
  blocks: Interval[]
  color: string
  top: (d: Date) => number
  height: (i: Interval) => number
}) {
  return (
    <div className={styles.dayColumn}>
      {blocks.map((block, i) => (
        <div
          key={i}
          className={styles.busyBlock}
          style={{
            top: top(block.start),
            height: height(block),
            background: fill(color),
            borderColor: line(color),
          }}
        >
          Occupé
          <div className={styles.busyTime}>{timeRange(block.start, block.end)}</div>
        </div>
      ))}
    </div>
  )
}
