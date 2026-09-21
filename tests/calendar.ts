/** Calendar maths: grids, heatmap shading, and the weekly pattern's day list. No Firebase, no DOM. */
import { addDays, addMinutes, dayValues, levelOf, monthGrid, monthsAround, scale, weekdayOf, yearColumns, ymd } from '../src/calendar.ts'
import type { Session } from '../src/store.ts'

let failed = 0
const check = (what: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `  -> ${JSON.stringify(got)}`}`)
  if (!ok) failed++
}

/* dates */
check('addDays crosses a month', addDays('2026-01-31', 1) === '2026-02-01', addDays('2026-01-31', 1))
check('addDays crosses a year backwards', addDays('2026-01-01', -1) === '2025-12-31', addDays('2026-01-01', -1))
check('addDays survives a DST switch', addDays('2026-03-28', 1) === '2026-03-29', addDays('2026-03-28', 1))
check('weekdayOf knows 2026-09-21 is a Monday', weekdayOf('2026-09-21') === 'mon', weekdayOf('2026-09-21'))
check('weekdayOf knows the Sunday before it', weekdayOf('2026-09-20') === 'sun', weekdayOf('2026-09-20'))
check('addMinutes rolls past midnight', addMinutes('23:30', 75) === '00:45', addMinutes('23:30', 75))
check('ymd is local, not UTC', ymd(new Date(2026, 8, 21, 23, 30).getTime()) === '2026-09-21')

/* month grid */
const sep = monthGrid(2026, 9) // September 2026 starts on a Tuesday
check('month grid pads to whole weeks', sep.length % 7 === 0, sep.length)
check('month grid leads with one blank', sep[0] === null && sep[1] === '2026-09-01', sep.slice(0, 2))
check('month grid holds every day', sep.filter(Boolean).length === 30, sep.filter(Boolean).length)
check('February 2026 has 28 days', monthGrid(2026, 2).filter(Boolean).length === 28)
check('February 2024 was a leap month', monthGrid(2024, 2).filter(Boolean).length === 29)

/* year grid */
const cols = yearColumns('2026-09-21')
check('year grid is 53 weeks of 7', cols.length === 53 && cols.every((c) => c.length === 7))
check('year grid columns start on Monday', cols.every((c) => weekdayOf(c[0]) === 'mon'))
check('year grid ends on the week holding today', cols[52].includes('2026-09-21'), cols[52])
check('year grid reaches back a year', cols[0][0] === '2025-09-22', cols[0][0])

/* months list */
const months = monthsAround('2026-01-15', 2, 1)
check('monthsAround walks back over a year end', JSON.stringify(months[0]) === JSON.stringify({ year: 2025, month: 11 }), months[0])
check('monthsAround runs to the month ahead', JSON.stringify(months.at(-1)) === JSON.stringify({ year: 2026, month: 2 }), months.at(-1))

/* heatmap */
const s = (date: string, durationSec: number, sets: number, weight: number): Session => ({
  id: date, date, start: '18:00', end: '19:00', routineId: null, planId: null, title: 'x', muscles: [], deviceId: 'd', syncedAt: null,
  at: 0, durationSec,
  exercises: [{ exerciseId: 'bench-press', name: 'Bench Press', sets: Array.from({ length: sets }, () => ({ weight, reps: 10 })) }],
})
const sessions = [s('2026-09-01', 1800, 5, 50), s('2026-09-02', 3600, 10, 60), s('2026-09-03', 5400, 20, 100), s('2026-09-04', 7200, 30, 120)]

const byTime = dayValues(sessions, 'time')
check('time counts minutes', byTime.get('2026-09-02') === 60, byTime.get('2026-09-02'))
check('sets counts sets', dayValues(sessions, 'sets').get('2026-09-03') === 20)
check('volume counts weight x reps', dayValues(sessions, 'volume').get('2026-09-01') === 5 * 50 * 10)
check('plain counts workouts', dayValues(sessions, 'plain').get('2026-09-01') === 1)
check('two workouts in a day add up', dayValues([...sessions, s('2026-09-01', 600, 2, 10)], 'time').get('2026-09-01') === 40)

check('a workout with nothing to measure still counts', (dayValues([s('2026-09-05', 0, 0, 0)], 'time').get('2026-09-05') ?? 0) > 0)

const t = scale(byTime.values())
check('rest days are level 0', levelOf(0, t, 'time') === 0)
check('the lightest day is level 1', levelOf(30, t, 'time') === 1, levelOf(30, t, 'time'))
check('the heaviest day is level 4', levelOf(120, t, 'time') === 4, levelOf(120, t, 'time'))
check('the shading spreads over all four levels', new Set([30, 60, 90, 120].map((v) => levelOf(v, t, 'time'))).size === 4, [30, 60, 90, 120].map((v) => levelOf(v, t, 'time')))
check('plain shades every trained day the same', [1, 9, 99].every((v) => levelOf(v, t, 'plain') === 4))
check('a day with nothing around it still shades', levelOf(5, scale([5]), 'time') === 3, levelOf(5, scale([5]), 'time'))
check('an even year uses the middle shade', new Set([9, 9, 9].map((v) => levelOf(v, scale([9, 9, 9]), 'time'))).size === 1)
check('an empty year does not divide by zero', levelOf(0, scale([]), 'time') === 0)

console.log(failed ? `\n${failed} failed` : '\nall good')
process.exit(failed ? 1 : 0)
