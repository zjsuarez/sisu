// Variant ids and names. Pure functions, no browser, no emulator: node --experimental-strip-types tests/naming.ts
import assert from 'node:assert'
import { BUILT_IN, BUILT_IN_MODIFIERS, buildExerciseId, canonicalExerciseId, resolveExercise } from '../src/exercises.ts'

const name = (id: string) => resolveExercise(id, BUILT_IN, BUILT_IN_MODIFIERS).name
const base = (id: string) => BUILT_IN.find((e) => e.id === id)!
const mods = (...ids: string[]) => ids.map((id) => BUILT_IN_MODIFIERS.find((m) => m.id === id)!)

let failures = 0
const check = (what: string, got: unknown, want: unknown) => {
  const ok = got === want
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : `\n        got  ${got}\n        want ${want}`}`)
  if (!ok) failures++
}

// names
check('plain base', name('bench-press'), 'Bench Press')
check('equipment prefixes', name('bench-press~dumbbell'), 'Dumbbell Bench Press')
check('equipment replaces the word already in the name', name('row~dumbbell'), 'Dumbbell Row')
check('position before equipment', name('row~cable+seated'), 'Seated Cable Row')
check('grip before equipment', name('bench-press~close-grip+dumbbell'), 'Close Grip Dumbbell Bench Press')
check('tempo and accessories in brackets', name('bench-press~2ct-pause+beltless'), 'Bench Press (2ct Pause, Beltless)')
check('a long stack stays readable', name('back-squat~low-bar+wide-stance+3ct-pause'), 'Low Bar Wide Stance Back Squat (3ct Pause)')

// ids written before the re-cut still resolve
check('alias: chin-up', name('chin-up'), 'Supinated Pull-up')
check('alias: dumbbell row', name('dumbbell-row'), 'Dumbbell Row')
check('alias: seated cable row', name('seated-cable-row'), 'Seated Cable Row')
check('alias: standing calf raise', name('standing-calf-raise'), 'Standing Calf Raise')
check('alias maps to the canonical id', canonicalExerciseId('incline-dumbbell-press'), 'incline-bench-press~dumbbell')

// ids
check('default equipment collapses to the base', buildExerciseId(base('bench-press'), mods('barbell')), 'bench-press')
check('a different equipment makes a variant', buildExerciseId(base('bench-press'), mods('dumbbell')), 'bench-press~dumbbell')
check(
  'pick order cannot create a second exercise',
  buildExerciseId(base('bench-press'), mods('2ct-pause', 'dumbbell')),
  buildExerciseId(base('bench-press'), mods('dumbbell', '2ct-pause')),
)
check('no modifiers is just the base', buildExerciseId(base('row'), []), 'row')

// a variant always counts towards its base's muscle
check('variant keeps the base muscle', resolveExercise('bench-press~machine+3ct-pause', BUILT_IN, BUILT_IN_MODIFIERS).base.muscle, 'chest')
// an unknown id (deleted custom exercise, removed modifier) must not throw
assert.doesNotThrow(() => resolveExercise('something-that-went-away~gone', BUILT_IN, BUILT_IN_MODIFIERS))

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
