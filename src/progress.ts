/**
 * What one exercise looks like over time. Pure — `npm run test:progress` drives it.
 *
 * Strength is compared with an estimated one-rep max, because 60×10 and 80×5 are not
 * comparable as raw weight but are as e1RM. Epley: w × (1 + reps/30), which is the
 * formula most lifting apps use, so the numbers match what people already know.
 */
export type Logged = { weight: number; reps: number; rir?: number; rpe?: number }

/**
 * How many reps were left in the tank. RIR says it directly; RPE is the same scale upside down
 * (RPE 8 = 2 left, RPE 10 = nothing left), so both end up as reps the set was worth.
 */
export const inReserve = (set: Logged) =>
  set.rir !== undefined ? Math.max(0, set.rir) : set.rpe !== undefined ? Math.min(10, Math.max(0, 10 - set.rpe)) : 0

export const e1rm = (set: Logged) => (set.reps > 0 && set.weight > 0 ? set.weight * (1 + (set.reps + inReserve(set)) / 30) : 0)

/**
 * A streak survives rest days: it only ends once `maxGap` days have passed without training,
 * counting from the last day you went. Days are day-start timestamps; two workouts in one day
 * count once. Returns how many training days the current run holds.
 */
export function streakOf(dayStarts: number[], today: number, maxGap = 4) {
  const days = [...new Set(dayStarts)].sort((a, b) => b - a)
  const gap = (later: number, earlier: number) => Math.round((later - earlier) / 86_400_000) // rounded: DST-safe
  if (!days.length || gap(today, days[0]) >= maxGap) return 0
  let streak = 1
  for (let i = 1; i < days.length && gap(days[i - 1], days[i]) < maxGap; i++) streak++
  return streak
}

/** the set that says the most about a session: the highest e1RM in it */
export const bestSet = (sets: Logged[]) => sets.reduce<Logged | null>((best, s) => (!best || e1rm(s) > e1rm(best) ? s : best), null)

/** One point per session, oldest first — what a chart needs. Sessions with nothing to measure drop out. */
export function points(history: { at: number; sets: Logged[] }[]) {
  return history
    .map((h) => {
      const best = bestSet(h.sets)
      return best && e1rm(best) > 0 ? { at: h.at, e1rm: e1rm(best), set: best, volume: h.sets.reduce((t, s) => t + s.weight * s.reps, 0), sets: h.sets.length } : null
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => a.at - b.at)
}

/** best e1RM ever, heaviest weight ever, and how the last session compares with the one before it */
export function summary(pts: ReturnType<typeof points>) {
  if (!pts.length) return null
  const best = pts.reduce((a, b) => (b.e1rm > a.e1rm ? b : a))
  const heaviest = pts.reduce((a, b) => (b.set.weight > a.set.weight ? b : a))
  const last = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  return { best, heaviest, last, change: prev ? last.e1rm - prev.e1rm : null, sessions: pts.length }
}
