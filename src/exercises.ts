// The exercise catalogue, its modifiers, and the rules that turn the two into one exercise.
// Design and decisions: CATALOGUE.md
//
// A variant is an id, not a record: `bench-press~dumbbell+2ct-pause`. Nothing is stored, and because
// logged sets already point at exercise ids, a variant gets its own history, records and
// "what you lifted last time" for free.

export const MUSCLES = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  core: 'Core', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', cardio: 'Cardio',
} as const

export type MuscleId = keyof typeof MUSCLES
export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[]
export const muscleLabel = (ids: MuscleId[]) => ids.map((m) => MUSCLES[m] ?? m).join(' · ')

/* ---------------------------------------------------------------- modifiers */

export type ModifierGroup = 'equipment' | 'stanceGrip' | 'other' | 'tempo' | 'rom' | 'load' | 'accessories' | 'custom'
export type Modifier = { id: string; label: string; group: ModifierGroup; custom?: boolean }

export const MODIFIER_GROUPS: { id: ModifierGroup; label: string }[] = [
  { id: 'equipment', label: 'Equipment' },
  { id: 'stanceGrip', label: 'Stance / Grip' },
  { id: 'tempo', label: 'Tempo' },
  { id: 'rom', label: 'Range of motion' },
  { id: 'load', label: 'Load accommodation' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'other', label: 'Other' },
]

/** Prefixed, in this order, before the exercise name. */
const PREFIX_ORDER: ModifierGroup[] = ['other', 'stanceGrip', 'equipment']
/** Listed in brackets after the name: how you did it, rather than what it is. */
const BRACKET_ORDER: ModifierGroup[] = ['tempo', 'rom', 'load', 'accessories', 'custom']
/** Canonical order inside an id, so the same set of modifiers always produces the same id. */
const ID_ORDER: ModifierGroup[] = [...PREFIX_ORDER, ...BRACKET_ORDER]

const mod = (group: ModifierGroup) => (id: string, label: string): Modifier => ({ id, label, group })
const equip = mod('equipment')
const grip = mod('stanceGrip')
const other = mod('other')
const tempo = mod('tempo')
const rom = mod('rom')
const load = mod('load')
const acc = mod('accessories')

export const BUILT_IN_MODIFIERS: Modifier[] = [
  equip('dumbbell', 'Dumbbell'), equip('barbell', 'Barbell'), equip('cable', 'Cable'), equip('machine', 'Machine'),
  equip('smith-machine', 'Smith Machine'), equip('z-bar', 'Z Bar'), equip('safety-bar', 'Safety Bar'), equip('trap-bar', 'Trap Bar'),

  grip('high-bar', 'High Bar'), grip('low-bar', 'Low Bar'), grip('pronated', 'Pronated'), grip('supinated', 'Supinated'),
  grip('snatch-grip', 'Snatch Grip'), grip('close-grip', 'Close Grip'), grip('wide-grip', 'Wide Grip'),
  grip('neutral-grip', 'Neutral Grip'), grip('close-stance', 'Close Stance'), grip('wide-stance', 'Wide Stance'),

  tempo('1ct-pause', '1ct Pause'), tempo('2ct-pause', '2ct Pause'), tempo('3ct-pause', '3ct Pause'), tempo('5ct-pause', '5ct Pause'),
  tempo('low-2ct-pause', 'Low 2ct Pause'), tempo('high-2ct-pause', 'High 2ct Pause'), tempo('touch-and-go', 'Touch & Go'),
  tempo('300-tempo', '300 Tempo'), tempo('303-tempo', '303 Tempo'), tempo('320-tempo', '320 Tempo'),
  tempo('400-tempo', '400 Tempo'), tempo('500-tempo', '500 Tempo'),

  rom('spoto', 'Spoto'), rom('low-pin', 'Low Pin'), rom('middle-pin', 'Middle Pin'), rom('high-pin', 'High Pin'),
  rom('low-block', 'Low Block'), rom('high-block', 'High Block'), rom('board', 'Board'), rom('box', 'Box'), rom('deficit', 'Deficit'),

  load('band', 'Band'), load('reverse-band', 'Reverse Band'),

  acc('belt', 'Belt'), acc('beltless', 'Beltless'),

  other('unilateral', 'Unilateral'), other('seated', 'Seated'), other('standing', 'Standing'), other('lying', 'Lying'),
  other('feet-up', 'Feet Up'), other('goblet', 'Goblet'), other('weighted', 'Weighted'), other('assisted', 'Assisted'),
  other('larsen', 'Larsen'), other('clusters', 'Clusters'), other('kodama', 'Kodama'),
]

export type EquipmentId = 'dumbbell' | 'barbell' | 'cable' | 'machine' | 'smith-machine' | 'z-bar' | 'safety-bar' | 'trap-bar'

/* ---------------------------------------------------------------- catalogue */

export type Exercise = {
  id: string
  name: string
  muscle: MuscleId // the main one; this is what muscle summaries count
  secondary: MuscleId[] // helpers, deliberately not counted
  description: string | null
  /** what it's normally done with. Never shown in the name; it decides which equipment modifier
   *  collapses back to this exercise, and which word a different one replaces. */
  equipment?: EquipmentId
  custom?: boolean
}

const ex = (name: string, muscle: MuscleId, secondary: MuscleId[] = [], equipment?: EquipmentId): Exercise => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  muscle,
  secondary,
  description: null,
  equipment,
})

export const BUILT_IN: Exercise[] = [
  // chest
  ex('Bench Press', 'chest', ['triceps', 'shoulders'], 'barbell'),
  ex('Incline Bench Press', 'chest', ['shoulders', 'triceps'], 'barbell'),
  ex('Decline Bench Press', 'chest', ['triceps'], 'barbell'),
  ex('Chest Fly', 'chest', [], 'dumbbell'),
  ex('Crossover', 'chest', [], 'cable'),
  ex('Chest Press', 'chest', ['triceps', 'shoulders'], 'machine'),
  ex('Push-up', 'chest', ['triceps', 'core']),
  ex('Dip', 'chest', ['triceps']),

  // back
  ex('Deadlift', 'back', ['hamstrings', 'glutes', 'forearms'], 'barbell'),
  ex('Sumo Deadlift', 'glutes', ['hamstrings', 'back'], 'barbell'),
  ex('Row', 'back', ['biceps'], 'barbell'),
  ex('T-Bar Row', 'back', ['biceps']),
  ex('Pull-up', 'back', ['biceps']),
  ex('Lat Pulldown', 'back', ['biceps']),
  ex('Face Pull', 'back', ['shoulders']),
  ex('Shrug', 'back', ['forearms'], 'barbell'),

  // shoulders
  ex('Overhead Press', 'shoulders', ['triceps'], 'barbell'),
  ex('Arnold Press', 'shoulders', ['triceps'], 'dumbbell'),
  ex('Lateral Raise', 'shoulders', [], 'dumbbell'),
  ex('Rear Delt Fly', 'shoulders', [], 'dumbbell'),
  ex('Upright Row', 'shoulders', ['forearms'], 'barbell'),

  // biceps
  ex('Curl', 'biceps', ['forearms'], 'barbell'),
  ex('Hammer Curl', 'biceps', ['forearms'], 'dumbbell'),
  ex('Preacher Curl', 'biceps', [], 'barbell'),
  ex('Incline Curl', 'biceps', [], 'dumbbell'),

  // triceps
  ex('Tricep Pushdown', 'triceps'),
  ex('Overhead Tricep Extension', 'triceps', [], 'dumbbell'),
  ex('Skull Crusher', 'triceps', [], 'barbell'),
  ex('Tricep Kickback', 'triceps', [], 'dumbbell'),

  // forearms
  ex('Wrist Curl', 'forearms', [], 'barbell'),
  ex('Reverse Curl', 'forearms', ['biceps'], 'barbell'),
  ex("Farmer's Walk", 'forearms', ['core'], 'dumbbell'),

  // core
  ex('Plank', 'core'),
  ex('Cable Crunch', 'core'),
  ex('Hanging Leg Raise', 'core'),
  ex('Ab Wheel', 'core'),
  ex('Russian Twist', 'core'),
  ex('Sit-up', 'core'),

  // quads
  ex('Back Squat', 'quads', ['glutes', 'hamstrings'], 'barbell'),
  ex('Front Squat', 'quads', ['glutes', 'core'], 'barbell'),
  ex('Leg Press', 'quads', ['glutes']),
  ex('Hack Squat', 'quads', ['glutes']),
  ex('Bulgarian Split Squat', 'quads', ['glutes'], 'dumbbell'),
  ex('Walking Lunge', 'quads', ['glutes'], 'dumbbell'),
  ex('Leg Extension', 'quads'),

  // hamstrings
  ex('Romanian Deadlift', 'hamstrings', ['glutes', 'back'], 'barbell'),
  ex('Stiff-Leg Deadlift', 'hamstrings', ['glutes', 'back'], 'barbell'),
  ex('Leg Curl', 'hamstrings'),
  ex('Nordic Curl', 'hamstrings'),
  ex('Good Morning', 'hamstrings', ['glutes', 'back'], 'barbell'),

  // glutes
  ex('Hip Thrust', 'glutes', ['hamstrings'], 'barbell'),
  ex('Glute Bridge', 'glutes', ['hamstrings'], 'barbell'),
  ex('Kickback', 'glutes', [], 'cable'),

  // calves
  ex('Calf Raise', 'calves'),

  // cardio
  ex('Treadmill Run', 'cardio'),
  ex('Incline Walk', 'cardio'),
  ex('Cycling', 'cardio'),
  ex('Rowing Machine', 'cardio', ['back']),
  ex('Stair Climber', 'cardio', ['quads']),
  ex('Jump Rope', 'cardio', ['calves']),
]

/** Entries that used to be their own exercise and are now a base plus modifiers.
 *  Old ids keep resolving, so routines and logged workouts written before the re-cut still work. */
export const ALIASES: Record<string, string> = {
  'dumbbell-bench-press': 'bench-press~dumbbell',
  'incline-dumbbell-press': 'incline-bench-press~dumbbell',
  'close-grip-bench-press': 'bench-press~close-grip',
  'cable-crossover': 'crossover',
  'barbell-row': 'row',
  'dumbbell-row': 'row~dumbbell',
  'seated-cable-row': 'row~cable+seated',
  'chin-up': 'pull-up~supinated',
  'dumbbell-shoulder-press': 'overhead-press~dumbbell',
  'barbell-curl': 'curl',
  'dumbbell-curl': 'curl~dumbbell',
  'cable-curl': 'curl~cable',
  'cable-kickback': 'kickback',
  'standing-calf-raise': 'calf-raise~standing',
  'seated-calf-raise': 'calf-raise~seated',
  'leg-press-calf-raise': 'calf-raise~machine',
}

/* ---------------------------------------------------------------- ids */

const groupRank = (m: Modifier) => {
  const i = ID_ORDER.indexOf(m.group)
  return i === -1 ? ID_ORDER.length : i
}

/** An id written before the re-cut, rewritten to what it is now. */
export const canonicalExerciseId = (id: string): string => {
  const { baseId, modifierIds } = splitExerciseId(id)
  return modifierIds.length ? `${baseId}~${modifierIds.join('+')}` : baseId
}

export const splitExerciseId = (id: string): { baseId: string; modifierIds: string[] } => {
  const canonical = ALIASES[id] ?? id
  const [baseId, mods] = canonical.split('~')
  return { baseId, modifierIds: mods ? mods.split('+').filter(Boolean) : [] }
}

/**
 * The id for a base plus a set of modifiers. Modifiers are sorted, so picking them in a different
 * order can't create a second exercise, and the base's own equipment is dropped, so "Bench Press
 * with a barbell" stays Bench Press instead of splitting its history.
 */
export function buildExerciseId(base: Exercise, modifiers: Modifier[]): string {
  const kept = modifiers.filter((m) => !(m.group === 'equipment' && m.id === base.equipment))
  if (!kept.length) return base.id
  const sorted = [...kept].sort((a, b) => groupRank(a) - groupRank(b) || a.id.localeCompare(b.id))
  return `${base.id}~${sorted.map((m) => m.id).join('+')}`
}

const EQUIPMENT_LABEL: Record<string, string> = Object.fromEntries(BUILT_IN_MODIFIERS.filter((m) => m.group === 'equipment').map((m) => [m.id, m.label]))

/** "Seated Cable Row", "Close Grip Dumbbell Bench Press", "Bench Press (2ct Pause, Beltless)" */
export function variantName(base: Exercise, modifiers: Modifier[]): string {
  if (!modifiers.length) return base.name

  let stem = base.name
  const equipment = modifiers.find((m) => m.group === 'equipment')
  // "Barbell Row" + Dumbbell reads as "Dumbbell Row", not "Dumbbell Barbell Row"
  const defaultLabel = base.equipment ? EQUIPMENT_LABEL[base.equipment] : undefined
  if (equipment && defaultLabel && stem.toLowerCase().startsWith(`${defaultLabel.toLowerCase()} `)) stem = stem.slice(defaultLabel.length + 1)

  const inOrder = (groups: ModifierGroup[]) =>
    groups.flatMap((g) => modifiers.filter((m) => m.group === g).sort((a, b) => a.id.localeCompare(b.id)))

  const prefix = inOrder(PREFIX_ORDER).map((m) => m.label)
  const brackets = inOrder(BRACKET_ORDER).map((m) => m.label)

  return [...prefix, stem].join(' ') + (brackets.length ? ` (${brackets.join(', ')})` : '')
}

export type ResolvedExercise = Exercise & { base: Exercise; modifiers: Modifier[] }

/**
 * Turn any exercise id — plain, aliased, or a variant — into something displayable.
 * Unknown ids (a deleted custom exercise, a modifier that no longer exists) resolve to a
 * placeholder rather than throwing: logged workouts keep the name they were saved with.
 */
export function resolveExercise(id: string, catalogue: Exercise[], modifiers: Modifier[]): ResolvedExercise {
  const { baseId, modifierIds } = splitExerciseId(id)
  const base = catalogue.find((e) => e.id === baseId) ?? { id: baseId, name: baseId, muscle: 'chest' as MuscleId, secondary: [], description: null }
  const mods = modifierIds.map((m) => modifiers.find((x) => x.id === m)).filter((m): m is Modifier => !!m)
  return { ...base, id, name: variantName(base, mods), base, modifiers: mods }
}
