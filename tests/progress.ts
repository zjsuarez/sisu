/** Estimated 1RM and the shape of an exercise's progress. No Firebase, no DOM. */
import { bestSet, e1rm, inReserve, points, summary } from '../src/progress.ts'

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

console.log(failed ? `\n${failed} failed` : '\nall good')
process.exit(failed ? 1 : 0)
