/**
 * Algèbre d'intervalles : fusion et complément.
 *
 * Sert à calculer les créneaux libres à deux. Le schéma fournit bien
 * `free_slots()` en SQL, mais cette fonction lit `events.starts_at`
 * directement et ne déplie pas les RRULE : un événement récurrent n'y
 * masquerait pas le créneau. On refait donc le calcul ici, à partir des
 * occurrences déjà dépliées.
 */

export type Interval = { start: Date; end: Date }

/** Fusionne les plages qui se chevauchent ou se touchent. */
export function merge(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime())
  const out: Interval[] = [{ ...sorted[0] }]

  for (const cur of sorted.slice(1)) {
    const last = out[out.length - 1]
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) last.end = cur.end
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/** Ce qui reste de [start, end] une fois `busy` retiré. */
export function complement(busy: Interval[], start: Date, end: Date): Interval[] {
  const gaps: Interval[] = []
  let cursor = start.getTime()

  for (const b of merge(clip(busy, start, end))) {
    if (b.start.getTime() > cursor) {
      gaps.push({ start: new Date(cursor), end: b.start })
    }
    cursor = Math.max(cursor, b.end.getTime())
  }

  if (cursor < end.getTime()) gaps.push({ start: new Date(cursor), end })
  return gaps
}

/** Découpe les plages à la fenêtre, jette celles qui n'y touchent pas. */
export function clip(intervals: Interval[], start: Date, end: Date): Interval[] {
  const out: Interval[] = []
  for (const i of intervals) {
    const s = Math.max(i.start.getTime(), start.getTime())
    const e = Math.min(i.end.getTime(), end.getTime())
    if (e > s) out.push({ start: new Date(s), end: new Date(e) })
  }
  return out
}

export function minutes(i: Interval): number {
  return (i.end.getTime() - i.start.getTime()) / 60_000
}

export function totalMinutes(intervals: Interval[]): number {
  return intervals.reduce((sum, i) => sum + minutes(i), 0)
}

export function overlaps(i: Interval, start: Date, end: Date): boolean {
  return i.end.getTime() > start.getTime() && i.start.getTime() < end.getTime()
}

/** Ne garde que les creux d'au moins `min` minutes. */
export function atLeast(intervals: Interval[], min: number): Interval[] {
  return intervals.filter((i) => minutes(i) >= min)
}
