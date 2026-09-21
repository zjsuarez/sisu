/**
 * Calendar maths: dates as local 'YYYY-MM-DD' strings, grids, and the year heatmap's shading.
 * Pure on purpose — no Firebase, no React — so `npm run test:calendar` can drive it.
 */
import type { Heatmap, Session, WeekdayId } from './store'

const pad = (n: number) => String(n).padStart(2, '0')

export const ymd = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const parts = (date: string) => date.split('-').map(Number) as [number, number, number]
/** local midnight of a date string */
export const dayMs = (date: string) => {
  const [y, m, d] = parts(date)
  return new Date(y, m - 1, d).getTime()
}
export const addDays = (date: string, n: number) => {
  const [y, m, d] = parts(date)
  return ymd(new Date(y, m - 1, d + n).getTime())
}

const WEEK: WeekdayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
/** 0 = Monday, matching WEEKDAYS in the store */
export const weekdayIndex = (date: string) => (new Date(dayMs(date)).getDay() + 6) % 7
export const weekdayOf = (date: string): WeekdayId => WEEK[weekdayIndex(date)]

export const toMin = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
export const addMinutes = (time: string, mins: number) => {
  const t = ((toMin(time) + mins) % 1440 + 1440) % 1440
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}

/** seconds between two 'HH:MM' times; end before start means it ran past midnight */
export const durationSec = (start: string, end: string) => ((((toMin(end) - toMin(start)) % 1440) + 1440) % 1440) * 60

export const volume = (exercises: { sets: { weight: number; reps: number; done?: boolean }[] }[]) =>
  exercises.reduce((t, e) => t + e.sets.reduce((s, x) => s + (x.done !== false ? x.weight * x.reps : 0), 0), 0)

/* ---------- year heatmap ---------- */

/** What one day is worth under the chosen metric. Several workouts in a day add up. */
export function dayValues(sessions: Session[], metric: Heatmap) {
  const out = new Map<string, number>()
  for (const s of sessions) {
    const v =
      metric === 'time' ? s.durationSec / 60
      : metric === 'sets' ? s.exercises.reduce((n, e) => n + e.sets.length, 0)
      : metric === 'volume' ? volume(s.exercises)
      : 1
    // a workout with nothing to measure (no weight, no logged time) still counts as a day trained
    out.set(s.date, (out.get(s.date) ?? 0) + Math.max(v, 0.5))
  }
  return out
}

/** Every day you trained, sorted: `levelOf` shades by where a day ranks in it, not by raw size. */
export function scale(values: Iterable<number>) {
  return [...values].filter((v) => v > 0).sort((a, b) => a - b)
}

const countBelow = (sorted: number[], v: number, orEqual: boolean) => {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (orEqual ? sorted[mid] <= v : sorted[mid] < v) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * 0 = rest, 1-4 = how that day ranks against the rest of the year. Ranking rather than
 * thresholding keeps all four shades in play whatever the metric, and one huge day can't
 * flatten the others. Ties land in the middle, so an even year isn't all level 1.
 */
export function levelOf(value: number, sorted: number[], metric: Heatmap = 'sets') {
  if (value <= 0) return 0
  if (metric === 'plain' || !sorted.length) return 4
  const rank = (countBelow(sorted, value, false) + countBelow(sorted, value, true)) / 2
  return 1 + Math.min(3, Math.floor((rank / sorted.length) * 4))
}

/** GitHub layout: one column per week (Monday first), ending on the week that holds `today`. */
export function yearColumns(today: string, weeks = 53) {
  const lastMonday = addDays(today, -weekdayIndex(today))
  const first = addDays(lastMonday, -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)))
}

/** A month as 6 rows of 7, Monday first; null where the cell belongs to another month. */
export function monthGrid(year: number, month: number) {
  const first = `${year}-${pad(month)}-01`
  const days = new Date(year, month, 0).getDate()
  const lead = weekdayIndex(first)
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

/** `count` months ending at the one holding `today`, plus `ahead` future ones. */
export function monthsAround(today: string, back: number, ahead: number) {
  const [y, m] = parts(today)
  return Array.from({ length: back + ahead + 1 }, (_, i) => {
    const d = new Date(y, m - 1 - back + i, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
}
