import { useSyncExternalStore } from 'react'

export type SetLog = { weight: number; reps: number; done: boolean }
export type ExerciseLog = { name: string; sets: SetLog[] }
export type RoutineExercise = { name: string; sets: number; reps: number; weight: number }
export type Routine = { id: string; name: string; tag: string; exercises: RoutineExercise[] }
export type Session = { id: string; routine: string; date: number; durationSec: number; exercises: ExerciseLog[] }
export type Active = { routineId: string; routine: string; startedAt: number; exercises: ExerciseLog[] }
export type Profile = { name: string; unit: 'kg' | 'lb'; weeklyGoal: number }
export type State = { profile: Profile; routines: Routine[]; sessions: Session[]; active: Active | null }

export const LIBRARY = [
  'Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raise', 'Tricep Pushdown',
  'Deadlift', 'Barbell Row', 'Pull-up', 'Lat Pulldown', 'Bicep Curl', 'Face Pull',
  'Back Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunge', 'Leg Curl', 'Calf Raise',
  'Hip Thrust', 'Plank', 'Cable Crunch',
]

const ex = (name: string, sets: number, reps: number, weight: number): RoutineExercise => ({ name, sets, reps, weight })

const SEED: State = {
  profile: { name: 'Athlete', unit: 'kg', weeklyGoal: 4 },
  routines: [
    { id: 'push', name: 'Push', tag: 'Chest · Shoulders · Triceps', exercises: [ex('Bench Press', 4, 8, 60), ex('Overhead Press', 3, 8, 40), ex('Incline Dumbbell Press', 3, 10, 22), ex('Tricep Pushdown', 3, 12, 25)] },
    { id: 'pull', name: 'Pull', tag: 'Back · Biceps', exercises: [ex('Deadlift', 3, 5, 100), ex('Pull-up', 3, 8, 0), ex('Barbell Row', 3, 8, 60), ex('Bicep Curl', 3, 12, 12)] },
    { id: 'legs', name: 'Legs', tag: 'Quads · Hamstrings · Glutes', exercises: [ex('Back Squat', 4, 6, 80), ex('Romanian Deadlift', 3, 10, 70), ex('Leg Press', 3, 12, 140), ex('Calf Raise', 4, 15, 40)] },
  ],
  sessions: [],
  active: null,
}

const KEY = 'sisu.v1'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...SEED, ...JSON.parse(raw) } : SEED
  } catch {
    return SEED // corrupt storage: start fresh rather than crash
  }
}

// ponytail: module-level store + useSyncExternalStore, swap for zustand if state grows past a few actions
let state = load()
const subs = new Set<() => void>()
const subscribe = (cb: () => void) => {
  subs.add(cb)
  return () => { subs.delete(cb) }
}

export const useStore = () => useSyncExternalStore(subscribe, () => state)

export function update(fn: (s: State) => State) {
  state = fn(state)
  localStorage.setItem(KEY, JSON.stringify(state))
  subs.forEach((cb) => cb())
}

export const uid = () => crypto.randomUUID()

export const volume = (exercises: ExerciseLog[]) =>
  exercises.reduce((t, e) => t + e.sets.reduce((s, x) => s + (x.done ? x.weight * x.reps : 0), 0), 0)

/* ---------- actions ---------- */

export const startSession = (r: Routine) =>
  update((s) => ({
    ...s,
    active: {
      routineId: r.id,
      routine: r.name,
      startedAt: Date.now(),
      exercises: r.exercises.map((e) => ({
        name: e.name,
        sets: Array.from({ length: e.sets }, () => ({ weight: e.weight, reps: e.reps, done: false })),
      })),
    },
  }))

const editActive = (fn: (a: Active) => Active) => update((s) => (s.active ? { ...s, active: fn(s.active) } : s))

export const editSet = (ei: number, si: number, patch: Partial<SetLog>) =>
  editActive((a) => ({
    ...a,
    exercises: a.exercises.map((e, i) =>
      i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...patch } : x)) },
    ),
  }))

export const addSet = (ei: number) =>
  editActive((a) => ({
    ...a,
    exercises: a.exercises.map((e, i) => {
      if (i !== ei) return e
      const last = e.sets.at(-1) ?? { weight: 0, reps: 10, done: false }
      return { ...e, sets: [...e.sets, { ...last, done: false }] }
    }),
  }))

export const addExercise = (name: string) =>
  editActive((a) => ({ ...a, exercises: [...a.exercises, { name, sets: [{ weight: 0, reps: 10, done: false }] }] }))

export const discardSession = () => update((s) => ({ ...s, active: null }))

export const finishSession = () =>
  update((s) => {
    if (!s.active) return s
    const exercises = s.active.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }))
      .filter((e) => e.sets.length)
    if (!exercises.length) return { ...s, active: null } // nothing logged, nothing saved
    const session: Session = {
      id: uid(),
      routine: s.active.routine,
      date: Date.now(),
      durationSec: Math.round((Date.now() - s.active.startedAt) / 1000),
      exercises,
    }
    // remember the weights used so next time starts where you left off
    const routines = s.routines.map((r) =>
      r.id !== s.active!.routineId
        ? r
        : {
            ...r,
            exercises: r.exercises.map((re) => {
              const done = exercises.find((e) => e.name === re.name)?.sets.at(-1)
              return done ? { ...re, weight: done.weight, reps: done.reps } : re
            }),
          },
    )
    return { ...s, routines, active: null, sessions: [session, ...s.sessions] }
  })

export const saveRoutine = (r: Routine) =>
  update((s) => ({
    ...s,
    routines: s.routines.some((x) => x.id === r.id) ? s.routines.map((x) => (x.id === r.id ? r : x)) : [...s.routines, r],
  }))

export const deleteRoutine = (id: string) => update((s) => ({ ...s, routines: s.routines.filter((r) => r.id !== id) }))

export const setProfile = (patch: Partial<Profile>) => update((s) => ({ ...s, profile: { ...s.profile, ...patch } }))

export const resetAll = () => update(() => SEED)

/* ---------- derived stats ---------- */

const DAY = 86_400_000
const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0)
const prevDay = (dayStart: number) => startOfDay(dayStart - DAY / 2) // DST-safe step back
export const startOfWeek = (t: number) => {
  const d = new Date(startOfDay(t))
  return d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Monday
}

export function stats(sessions: Session[], now = Date.now()) {
  const week = startOfWeek(now)
  const thisWeek = sessions.filter((x) => x.date >= week)

  // streak = consecutive days with a session, counting back from today (or yesterday)
  const days = new Set(sessions.map((x) => startOfDay(x.date)))
  let cursor = startOfDay(now)
  if (!days.has(cursor)) cursor = prevDay(cursor)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = prevDay(cursor)
  }

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = new Date(week).setDate(new Date(week).getDate() - 7 * (7 - i))
    const to = new Date(from).setDate(new Date(from).getDate() + 7)
    return { from, volume: volume(sessions.filter((x) => x.date >= from && x.date < to).flatMap((x) => x.exercises)) }
  })

  const prs = new Map<string, SetLog>()
  for (const e of sessions.flatMap((x) => x.exercises))
    for (const set of e.sets) {
      const best = prs.get(e.name)
      if (!best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) prs.set(e.name, set)
    }

  const weekDays = Array.from({ length: 7 }, (_, i) => days.has(new Date(week).setDate(new Date(week).getDate() + i)))

  return {
    thisWeek: thisWeek.length,
    weekVolume: volume(thisWeek.flatMap((x) => x.exercises)),
    streak,
    weeks,
    weekDays,
    prs: [...prs].sort((a, b) => b[1].weight - a[1].weight),
    totalVolume: volume(sessions.flatMap((x) => x.exercises)),
  }
}
