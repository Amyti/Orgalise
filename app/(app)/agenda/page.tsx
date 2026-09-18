import type { Metadata } from 'next'
import Link from 'next/link'

import { Strip } from '@/components/agenda/Strip'
import { Fab, NavSpacer } from '@/components/Fab'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/Icons'
import {
  WEEK_BAND,
  MIN_FREE_MINUTES,
  bestSlots,
  computeBand,
  hourOf,
  loadAgenda,
  splitDays,
  type Band,
  type DayView,
} from '@/lib/agenda'
import {
  addDays,
  clock,
  dayShort,
  isoDay,
  monthName,
  parseIsoDay,
  sameDay,
  timeRange,
  wall,
  weekDays,
} from '@/lib/dates'
import { atLeast, clip, minutes } from '@/lib/intervals'
import { requireSpace } from '@/lib/space'
import type { Space } from '@/lib/types'
import { AgendaTabs } from './AgendaTabs'
import { Legend } from './Legend'
import styles from './agenda.module.css'

export const metadata: Metadata = { title: 'Semaine' }

export default async function SemainePage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>
}) {
  const space = await requireSpace()
  const { semaine } = await searchParams

  const now = new Date()
  const anchor = parseIsoDay(semaine) ?? now
  const days = weekDays(anchor)
  const monday = days[0]

  const agenda = await loadAgenda(space, monday, addDays(monday, 7))
  const dayViews = splitDays(agenda, days)

  // Une bande pour les sept jours : c'est ce qui les garde comparables.
  const band = computeBand(dayViews, WEEK_BAND)
  const slots = bestSlots(dayViews, 2, band)

  const w = wall(monday)

  return (
    <div className="screen">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className="eyebrow">
            {monthName(monday)} {w.year}
          </div>
          <h1 className={`display ${styles.title}`}>Semaine du {w.day}</h1>
        </div>
        <div className={styles.headerActions}>
          <Link
            href={`/agenda?semaine=${isoDay(addDays(monday, -7))}`}
            className="btnIcon"
            aria-label="Semaine précédente"
          >
            <ChevronLeftIcon size={15} color="var(--ink)" />
          </Link>
          <Link
            href={`/agenda?semaine=${isoDay(addDays(monday, 7))}`}
            className="btnIcon"
            aria-label="Semaine suivante"
          >
            <ChevronRightIcon size={15} color="var(--ink)" />
          </Link>
        </div>
      </div>

      <AgendaTabs active="semaine" date={monday} />
      <Legend space={space} />

      <div className={styles.week}>
        {dayViews.map((day) => (
          <DayRow
            key={day.start.toISOString()}
            day={day}
            space={space}
            today={now}
            band={band}
          />
        ))}
      </div>

      <section className={styles.slots}>
        <div className={styles.slotsHead}>
          <h2 className={styles.slotsTitle}>Vos meilleurs creux</h2>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>cette semaine</div>
        </div>
        {slots.length > 0 ? (
          <div className={styles.slotsRow}>
            {slots.map(({ day, slot }) => (
              <Link
                key={slot.start.toISOString()}
                href={`/agenda/jour?date=${isoDay(day.start)}`}
                className={styles.slot}
              >
                <div className={styles.slotDay}>
                  {dayShort(day.start)} {wall(day.start).day}
                </div>
                <div className={styles.slotTime}>{timeRange(slot.start, slot.end)}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
            {space.partner
              ? 'Aucun créneau commun cette semaine. Regardez la suivante.'
              : "Dès que l'autre aura rejoint et branché son calendrier, vos creux communs apparaîtront ici."}
          </div>
        )}
      </section>

      <div className={styles.spacer} />
      <NavSpacer />
      <Fab
        href={`/agenda/evenement?date=${isoDay(anchor)}`}
        label="Ajouter un événement"
      />
    </div>
  )
}

function DayRow({
  day,
  space,
  today,
  band,
}: {
  day: DayView
  space: Space
  today: Date
  band: Band
}) {
  const isToday = sameDay(day.start, today)

  return (
    <Link
      href={`/agenda/jour?date=${isoDay(day.start)}`}
      className={`${styles.dayRow} ${isToday ? styles.dayRowToday : ''}`}
    >
      <div className={styles.dayStamp}>
        <div className={styles.dayName}>{dayShort(day.start)}</div>
        <div
          className={`${styles.dayNumber} ${isToday ? styles.dayNumberToday : ''}`}
        >
          {wall(day.start).day}
        </div>
      </div>

      <div className={styles.dayBody}>
        <Strip
          day={day}
          band={band}
          height={30}
          colors={{
            mine: space.me.color,
            theirs: space.partner?.color ?? 'transparent',
          }}
        />
        <DayMeta day={day} band={band} />
      </div>
    </Link>
  )
}

/** Une ligne de texte qui dit ce qu'il faut retenir de la journée. */
function DayMeta({ day, band }: { day: DayView; band: Band }) {
  const event = day.events[0]

  if (event) {
    return (
      <div className={styles.dayMeta}>
        <span className={styles.metaDot} style={{ background: 'var(--ink-strong)' }} />
        <span className={styles.metaStrong}>
          {event.event.title} · {clock(event.start)}
        </span>
      </div>
    )
  }

  const inBand = atLeast(
    clip(day.free, hourOf(day.start, band.from), hourOf(day.start, band.to)),
    MIN_FREE_MINUTES,
  )

  if (inBand.length === 0) {
    return (
      <div className={styles.dayMeta}>
        <span className={styles.metaDot} style={{ background: 'var(--border-strong)' }} />
        <span className={styles.metaSoft}>Rien de commun ce jour-là</span>
      </div>
    )
  }

  const best = inBand.reduce((a, b) => (minutes(b) > minutes(a) ? b : a))
  const untilEnd = best.end >= hourOf(day.start, band.to)

  return (
    <div className={styles.dayMeta}>
      <span className={styles.metaDot} style={{ background: 'var(--free-dot)' }} />
      <span className={styles.metaSoft}>
        {untilEnd
          ? `Libres à partir de ${clock(best.start)}`
          : `Libres ${timeRange(best.start, best.end)}`}
      </span>
    </div>
  )
}
