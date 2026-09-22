/** Estimated 1RM and the shape of an exercise's progress. No Firebase, no DOM. */
import { bestSet, e1rm, inReserve, newRecords, points, recentRecords, routineTime, streakOf, summary } from '../src/progress.ts'

let failed = 0
const check = (what: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `  -> ${JSON.stringify(got)}`}`)
  if (!ok) failed++
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.01

/* e1RM */
check('a single is its own max', e1rm({ weight: 100, reps: 1 }) === 100 * (1 + 1 / 30), e1rm({ weight: 100, reps: 1 }))
check('Epley: 100 x 10 is about 133', near(e1rm({ weight: 100, reps: 10 }), 133.33), e1rm({ weight: 100, reps: 10 }))
check('more reps at the same weight is more', e1rm({ weight: 60, reps: 8 }) > e1rm({ weight: 60, reps: 5 }))
check('a bodyweight set has no estimate', e1rm({ weight: 0, reps: 12 }) === 0)
check('a set with no reps has no estimate', e1rm({ weight: 80, reps: 0 }) === 0)

/* reps left in the tank count towards the estimate */
check('2 RIR makes 8 reps worth 10', near(e1rm({ weight: 100, reps: 8, rir: 2 }), e1rm({ weight: 100, reps: 10 })), e1rm({ weight: 100, reps: 8, rir: 2 }))
check('RPE 8 is the same as 2 RIR', near(e1rm({ weight: 100, reps: 8, rpe: 8 }), e1rm({ weight: 100, reps: 8, rir: 2 })))
check('RPE 10 left nothing in the tank', near(e1rm({ weight: 100, reps: 8, rpe: 10 }), e1rm({ weight: 100, reps: 8 })))
check('0 RIR is failure, not "no value"', near(e1rm({ weight: 100, reps: 8, rir: 0 }), e1rm({ weight: 100, reps: 8 })))
check('an RPE above 10 does not go negative', inReserve({ weight: 100, reps: 8, rpe: 11 }) === 0, inReserve({ weight: 100, reps: 8, rpe: 11 }))
check('no effort logged, nothing added', inReserve({ weight: 100, reps: 8 }) === 0)
check('an easy set beats a hard one at the same weight and reps', e1rm({ weight: 80, reps: 5, rir: 4 }) > e1rm({ weight: 80, reps: 5, rir: 0 }))

/* best set */
check('the best set is the strongest, not the heaviest', bestSet([{ weight: 100, reps: 1 }, { weight: 90, reps: 5 }])?.weight === 90, bestSet([{ weight: 100, reps: 1 }, { weight: 90, reps: 5 }]))
check('a set with reps to spare can be the best one', bestSet([{ weight: 80, reps: 8 }, { weight: 80, reps: 7, rir: 3 }])?.reps === 7, bestSet([{ weight: 80, reps: 8 }, { weight: 80, reps: 7, rir: 3 }]))
check('no sets, no best', bestSet([]) === null)

/* points */
const history = [
  { at: 3, sets: [{ weight: 70, reps: 8 }, { weight: 70, reps: 7 }] },
  { at: 1, sets: [{ weight: 60, reps: 8 }] },
  { at: 2, sets: [{ weight: 0, reps: 0 }] }, // a session where nothing measurable happened
]
const pts = points(history)
check('points come out oldest first', pts.map((p) => p.at).join() === '1,3', pts.map((p) => p.at))
check('a session with nothing to measure is left out', pts.length === 2, pts.length)
check('each point takes the session best', near(pts[1].e1rm, e1rm({ weight: 70, reps: 8 })), pts[1].e1rm)
check('volume counts every set in the session', pts[1].volume === 70 * 8 + 70 * 7, pts[1].volume)

/* summary */
const sum = summary(pts)!
check('the summary knows the best ever', near(sum.best.e1rm, e1rm({ weight: 70, reps: 8 })))
check('and the heaviest weight ever', sum.heaviest.set.weight === 70, sum.heaviest.set.weight)
check('and the change since last time', sum.change !== null && sum.change > 0, sum.change)
check('one session has nothing to compare with', summary(points([history[1]]))?.change === null)
check('no history, no summary', summary([]) === null)

/* new records */
const push = (weight: number, reps = 8) => [{ exerciseId: 'bench', name: 'Bench Press', sets: [{ weight, reps }] }]
check('the first time you log an exercise is a record', newRecords(push(60), []).length === 1)
check('beating your best is a record', newRecords(push(70), [{ exercises: push(60) }]).length === 1)
check('matching it is not', newRecords(push(60), [{ exercises: push(60) }]).length === 0)
check('less weight for more reps can still be one', newRecords(push(60, 12), [{ exercises: push(65, 8) }]).length === 1)
check('a record names the set that made it', newRecords(push(70), [{ exercises: push(60) }])[0].set.weight === 70)
check('only the exercises you actually beat count', newRecords([...push(70), { exerciseId: 'squat', name: 'Squat', sets: [{ weight: 50, reps: 5 }] }], [{ exercises: [...push(60), { exerciseId: 'squat', name: 'Squat', sets: [{ weight: 100, reps: 5 }] }] }]).map((r) => r.exerciseId).join() === 'bench')
check('a set with nothing to measure is never a record', newRecords([{ exerciseId: 'bw', name: 'Push Up', sets: [{ weight: 0, reps: 20 }] }], []).length === 0)


/* recent records */
const hist = [
  { at: 1, exercises: push(60) },
  { at: 2, exercises: push(55) },
  { at: 3, exercises: push(70) },
  { at: 4, exercises: [{ exerciseId: 'squat', name: 'Squat', sets: [{ weight: 100, reps: 5 }] }] },
]
const recents = recentRecords(hist, 5)
check('every record is caught as it happens', recents.length === 3, recents.map((r) => r.at))
check('and the newest comes first', recents[0].at === 4 && recents[0].name === 'Squat', recents[0])
check('a session that beat nothing is left out', !recents.some((r) => r.at === 2))
check('the limit is respected', recentRecords(hist, 1).length === 1)
check('no workouts, no records', recentRecords([], 3).length === 0)

/* how long a routine takes */
const logs = [
  { routineId: 'push', durationSec: 3600 },
  { routineId: 'push', durationSec: 4200 },
  { routineId: 'push', durationSec: 0 }, // started and finished in the same minute
  { routineId: 'pull', durationSec: 1800 },
  { routineId: null, durationSec: 9000 },
]
check('a routine averages its own workouts', routineTime(logs, 'push')?.seconds === 3900, routineTime(logs, 'push'))
check('and says how many it averaged', routineTime(logs, 'push')?.workouts === 2, routineTime(logs, 'push'))
check('a zero-length workout is not a fast one', routineTime(logs, 'push')?.workouts !== 3)
check('a routine never trained has no average', routineTime(logs, 'legs') === null)
check('workouts with no routine belong to none of them', routineTime(logs, 'pull')?.seconds === 1800)

/* streaks: a rest day is fine, four days off is not */
const day = 86_400_000
const today = new Date(2026, 8, 21).getTime()
const ago = (n: number) => today - n * day
check('no workouts, no streak', streakOf([], today) === 0)
check('training today starts one', streakOf([ago(0)], today) === 1, streakOf([ago(0)], today))
check('yesterday still counts', streakOf([ago(1)], today) === 1)
check('three days off keeps it alive', streakOf([ago(3)], today) === 1, streakOf([ago(3)], today))
check('four days off ends it', streakOf([ago(4)], today) === 0, streakOf([ago(4)], today))
check('a run of days adds up', streakOf([ago(0), ago(2), ago(5), ago(7)], today) === 4, streakOf([ago(0), ago(2), ago(5), ago(7)], today))
check('it stops at the first four-day hole', streakOf([ago(0), ago(2), ago(6), ago(7)], today) === 2, streakOf([ago(0), ago(2), ago(6), ago(7)], today))
check('two workouts in one day count once', streakOf([ago(1), ago(1), ago(3)], today) === 2, streakOf([ago(1), ago(1), ago(3)], today))
check('an old run that already died stays dead', streakOf([ago(10), ago(12)], today) === 0)


console.log(failed ? `\n${failed} failed` : '\nall good')
process.exit(failed ? 1 : 0)
