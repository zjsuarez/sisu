import { useSyncExternalStore } from 'react'
import { getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  waitForPendingWrites,
  writeBatch,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { addDays, addMinutes, toMin, volume, weekdayOf, ymd } from './calendar'

import { BUILT_IN, BUILT_IN_MODIFIERS, canonicalExerciseId, resolveExercise, type Exercise, type Modifier, type MuscleId } from './exercises'

// Schema: FIREBASE_SCHEMA.md (shared with the schedule app)

export { MUSCLES, MUSCLE_IDS, muscleLabel, MODIFIER_GROUPS, BUILT_IN_MODIFIERS, buildExerciseId, splitExerciseId, variantName } from './exercises'
export type { Exercise, Modifier, ModifierGroup, MuscleId, ResolvedExercise } from './exercises'
export { addDays, addMinutes, volume, weekdayOf, ymd }

/** effort is stored with its kind, never a bare number: switching the setting must not reinterpret history */
export type SetLog = { weight: number; reps: number; rir?: number; rpe?: number; done?: boolean }
export type ExerciseLog = { exerciseId: string; name: string; sets: SetLog[] }
/** a fixed target is a range with both ends equal, so a set never changes shape */
export type RepTarget = { repsMin: number; repsMax: number }
export type RoutineExercise = { exerciseId: string; name: string; sets: RepTarget[] }
export type Routine = { id: string; name: string; planId: string | null; muscles: MuscleId[]; exercises: RoutineExercise[] }
export type WeekdayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type WeeklySchedule = Record<WeekdayId, string | null>
/** A plan is a name, its routines, and either a weekly pattern or nothing at all. */
export type Plan = {
  id: string
  name: string
  routineIds: string[]
  schedule: WeeklySchedule | null
  defaultStart: string | null
  defaultMinutes: number | null
  generatedThrough: string | null // last date the weekly pattern filled, so deleting a day doesn't resurrect it
  createdAt: number
}
export type Session = {
  id: string
  date: string // 'YYYY-MM-DD' local
  start: string // 'HH:MM' local
  end: string
  routineId: string | null
  planId: string | null
  title: string
  muscles: MuscleId[]
  exercises: ExerciseLog[]
  deviceId: string
  syncedAt: number | null // server time it reached the cloud; null while waiting to upload
  at: number // derived: local ms of date + start, for sorting and stats
  durationSec: number // derived from start/end
}
export type Device = { id: string; name: string; type: 'phone' | 'desktop'; lastSyncedAt: number | null }
/** A planned workout. Co-owned: the schedule app creates and edits these too (FIREBASE_SCHEMA.md §2). */
export type Slot = {
  id: string
  date: string
  start: string | null // both-or-neither with end; null = no time assigned
  end: string | null
  routineId: string | null
  title: string | null
  sessionId: string | null // set when a logged workout fulfils this slot; null = still planned
  planId: string | null // set on slots a plan's weekly pattern produced
  generated: boolean // true = written by the pattern, so re-generating may replace it
  at: number // derived: local ms of date + start (midnight when untimed)
}
export type ActiveExercise = ExerciseLog & { targets: RepTarget[] }
export type Active = { routineId: string; routine: string; muscles: MuscleId[]; startedAt: number; exercises: ActiveExercise[]; slotId: string | null }
export type Effort = 'rir' | 'rpe' | 'none'
/** what the year grid shades by */
export type Heatmap = 'time' | 'sets' | 'volume' | 'plain'
export type Profile = { name: string; unit: 'kg' | 'lb'; weeklyGoal: number; effort: Effort; heatmap: Heatmap; activePlanId: string | null }
export type Sync = { waiting: number; inSync: boolean; online: boolean; error: string | null }
export type State = {
  user: User | null | undefined // undefined while the saved sign-in is being restored
  authError: string | null
  profile: Profile
  plans: Plan[]
  routines: Routine[]
  /** base exercises: the built-in catalogue plus the user's own. Variants are ids, not records. */
  exercises: Exercise[]
  /** built-in modifiers plus the user's own */
  modifiers: Modifier[]
  sessions: Session[]
  slots: Slot[]
  devices: Device[]
  active: Active | null // in-progress workout: device-only, never synced
  /** the schedule app still holds gym data that its migration hasn't moved yet */
  importPending: boolean
  sync: Sync
}

export const WEEKDAYS: { id: WeekdayId; label: string }[] = [
  { id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed' }, { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' }, { id: 'sat', label: 'Sat' }, { id: 'sun', label: 'Sun' },
]

export const repLabel = (t: RepTarget) => (t.repsMin === t.repsMax ? `${t.repsMax}` : `${t.repsMin}-${t.repsMax}`)
export const sameTarget = (a: RepTarget, b: RepTarget) => a.repsMin === b.repsMin && a.repsMax === b.repsMax

const seedEx = (exerciseId: string, sets: number, reps: number): RoutineExercise => ({
  exerciseId,
  name: resolveExercise(exerciseId, BUILT_IN, BUILT_IN_MODIFIERS).name,
  sets: Array.from({ length: sets }, () => ({ repsMin: reps, repsMax: reps })),
})

const SEED_ROUTINES: { name: string; exercises: RoutineExercise[] }[] = [
  { name: 'Push', exercises: [seedEx('bench-press', 4, 8), seedEx('overhead-press', 3, 8), seedEx('incline-bench-press~dumbbell', 3, 10), seedEx('tricep-pushdown', 3, 12)] },
  { name: 'Pull', exercises: [seedEx('deadlift', 3, 5), seedEx('pull-up', 3, 8), seedEx('row', 3, 8), seedEx('curl', 3, 12)] },
  { name: 'Legs', exercises: [seedEx('back-squat', 4, 6), seedEx('romanian-deadlift', 3, 10), seedEx('leg-press', 3, 12), seedEx('calf-raise~standing', 4, 15)] },
]

const DEFAULT_SETTINGS = { unit: 'kg' as const, weeklyGoal: 4, effort: 'rir' as const, heatmap: 'time' as const, activePlanId: null }

export const newId = () => crypto.randomUUID()

/* ---------- weight ---------- */
// Stored in kg always, so switching the unit relabels nothing and history stays true.
const LB_PER_KG = 2.2046226218
export const toKg = (v: number, unit: Profile['unit']) => (unit === 'kg' ? v : v / LB_PER_KG)
export const fromKg = (kg: number, unit: Profile['unit']) => (unit === 'kg' ? Math.round(kg * 100) / 100 : Math.round(kg * LB_PER_KG * 2) / 2)

/* ---------- local dates (same convention as the schedule app: local strings, no time zone) ---------- */

const pad = (n: number) => String(n).padStart(2, '0')
const hm = (t: number) => {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const toMs = (date: string, time: string) => {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}
// end < start crosses midnight
const durationSec = (start: string, end: string) => (((toMin(end) - toMin(start)) % 1440) + 1440) % 1440 * 60

/* ---------- this device ---------- */

const ACTIVE_KEY = 'sisu.active'
const LEGACY_KEY = 'sisu.v1' // pre-Firebase localStorage state, uploaded once on first sign-in

const stored = (key: string, make: () => string) => localStorage.getItem(key) ?? (localStorage.setItem(key, make()), localStorage.getItem(key)!)

export const deviceId = stored('sisu.deviceId', newId)

const ua = navigator.userAgent
const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Linux'
const browser = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : 'Safari'
export const installed = matchMedia('(display-mode: standalone)').matches || !!(navigator as { standalone?: boolean }).standalone
// ponytail: mouse + large screen = desktop; a touchscreen laptop counts as a phone, add a manual override if that bites
export const deviceType: Device['type'] = matchMedia('(pointer: fine) and (min-width: 1024px)').matches ? 'desktop' : 'phone'
export const deviceName = () => stored('sisu.deviceName', () => (installed ? `${os} app` : `${os} · ${browser}`))

/* ---------- store ---------- */

function loadActive(): Active | null {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null')
  } catch {
    return null // corrupt storage: lose the in-progress workout rather than crash
  }
}

const firstName = (user: User | null | undefined) => user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Athlete'

let state: State = {
  user: undefined,
  authError: null,
  profile: { name: 'Athlete', ...DEFAULT_SETTINGS },
  plans: [],
  routines: [],
  exercises: BUILT_IN,
  modifiers: BUILT_IN_MODIFIERS,
  sessions: [],
  slots: [],
  devices: [],
  active: loadActive(),
  importPending: false,
  sync: { waiting: 0, inSync: false, online: navigator.onLine, error: null },
}

const subs = new Set<() => void>()
const subscribe = (cb: () => void) => {
  subs.add(cb)
  return () => { subs.delete(cb) }
}
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  subs.forEach((cb) => cb())
}
const setSync = (patch: Partial<Sync>) => set({ sync: { ...state.sync, ...patch } })

export const useStore = () => useSyncExternalStore(subscribe, () => state)

addEventListener('online', () => setSync({ online: true }))
addEventListener('offline', () => setSync({ online: false }))

// Writes resolve only when the server acknowledges them, so they're never awaited (that would hang offline).
// A rejection means the server refused the write (e.g. security rules): surface it instead of losing it silently.
const fail = (e: unknown) => {
  console.error('[sisu] write rejected', e)
  setSync({ error: e instanceof Error ? e.message : String(e) })
}

/* ---------- Firestore paths ---------- */
// ponytail: every path lives here; Sisu only ever writes under users/{uid}/apps/gym

const gymRef = (uid: string) => doc(db, 'users', uid, 'apps', 'gym')
const col = (uid: string, name: 'plans' | 'routines' | 'exercises' | 'modifiers' | 'sessions' | 'slots' | 'devices') => collection(db, 'users', uid, 'apps', 'gym', name)
const me = () => state.user?.uid ?? '' // actions are only reachable after sign-in

const ms = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : null)

/** Any exercise id — plain, from before the re-cut, or a variant — as something displayable. */
export const resolve = (id: string) => resolveExercise(id, state.exercises, state.modifiers)

/* ---------- reading documents written before exercises had ids ---------- */

const slug = (name: string) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')
const idForName = (name: string) => BUILT_IN.find((x) => x.name.toLowerCase() === String(name).toLowerCase())?.id ?? slug(name)

type LegacyRoutineExercise = { name: string; sets: number; reps: number }
const readRoutineExercise = (e: RoutineExercise | LegacyRoutineExercise): RoutineExercise =>
  Array.isArray(e.sets)
    ? { exerciseId: canonicalExerciseId((e as RoutineExercise).exerciseId ?? idForName(e.name)), name: e.name, sets: e.sets }
    : { exerciseId: canonicalExerciseId(idForName(e.name)), name: e.name, sets: Array.from({ length: (e as LegacyRoutineExercise).sets || 3 }, () => ({ repsMin: (e as LegacyRoutineExercise).reps || 10, repsMax: (e as LegacyRoutineExercise).reps || 10 })) }

const readLoggedExercise = (e: { exerciseId?: string; name: string; sets: SetLog[] }): ExerciseLog => ({
  exerciseId: canonicalExerciseId(e.exerciseId ?? idForName(e.name)),
  name: e.name,
  sets: e.sets ?? [],
})

/* ---------- auth + live data ---------- */

export function signIn() {
  set({ authError: null })
  const provider = new GoogleAuthProvider()
  // without this, the popup silently uses whatever Google account the browser is already signed into
  provider.setCustomParameters({ prompt: 'select_account' })
  const redirect = () => signInWithRedirect(auth, provider).catch((e) => set({ authError: e.message }))
  // same as the schedule app: popups are unreliable in home-screen apps, so those always redirect
  if (installed) return redirect()
  signInWithPopup(auth, provider).catch((e) => (e.code === 'auth/popup-blocked' ? redirect() : e.code !== 'auth/popup-closed-by-user' && set({ authError: e.message })))
}

export function signOut() {
  setActive(null)
  fbSignOut(auth)
}

getRedirectResult(auth).catch((e) => set({ authError: e.message }))

let unsubs: (() => void)[] = []

onAuthStateChanged(auth, (user) => {
  unsubs.forEach((u) => u())
  unsubs = []
  set({
    user,
    profile: { name: firstName(user), ...DEFAULT_SETTINGS },
    plans: [],
    routines: [],
    exercises: BUILT_IN,
    modifiers: BUILT_IN_MODIFIERS,
    sessions: [],
    slots: [],
    devices: [],
    importPending: false,
    sync: { ...state.sync, waiting: 0, inSync: false, error: null },
  })
  if (user) listen(user)
})

function listen(user: User) {
  const uid = user.uid
  const meta = { includeMetadataChanges: true }
  const waiting: Record<string, number> = {}
  const cached: Record<string, boolean> = {}
  // which listeners still hold unsent writes, and whether any is serving cached (not server-confirmed) data
  const track = (key: string, pending: number, fromCache: boolean) => {
    waiting[key] = pending
    cached[key] = fromCache
    setSync({ waiting: Object.values(waiting).reduce((a, b) => a + b, 0), inSync: !Object.values(cached).some(Boolean) })
  }
  const pendingDocs = (snap: QuerySnapshot) => snap.docs.filter((d) => d.metadata.hasPendingWrites).length

  unsubs.push(
    onSnapshot(gymRef(uid), meta, (snap: DocumentSnapshot) => {
      set({
        profile: {
          name: firstName(user),
          unit: snap.get('unit') ?? DEFAULT_SETTINGS.unit,
          weeklyGoal: snap.get('weeklyGoal') ?? DEFAULT_SETTINGS.weeklyGoal,
          effort: snap.get('effort') ?? DEFAULT_SETTINGS.effort,
          heatmap: snap.get('heatmap') ?? DEFAULT_SETTINGS.heatmap,
          activePlanId: snap.get('activePlanId') ?? null,
        },
      })
      track('gym', snap.metadata.hasPendingWrites ? 1 : 0, snap.metadata.fromCache)
    }),
    onSnapshot(col(uid, 'plans'), meta, (snap: QuerySnapshot) => {
      const order = (c: unknown) => ms(c) ?? Infinity
      set({
        plans: snap.docs
          .sort((a, b) => order(a.get('createdAt')) - order(b.get('createdAt')))
          .map((d) => ({
            id: d.id,
            name: d.get('name'),
            routineIds: d.get('routineIds') ?? [],
            schedule: d.get('schedule') ?? null,
            defaultStart: d.get('defaultStart') ?? null,
            defaultMinutes: d.get('defaultMinutes') ?? null,
            generatedThrough: d.get('generatedThrough') ?? null,
            createdAt: ms(d.get('createdAt')) ?? Date.now(),
          })),
      })
      track('plans', pendingDocs(snap), snap.metadata.fromCache)
    }),
    onSnapshot(col(uid, 'routines'), meta, (snap: QuerySnapshot) => {
      // no query, sorted here: routines migrated from the schedule app have no createdAt and go last
      const order = (c: unknown) => ms(c) ?? Infinity
      set({
        routines: snap.docs
          .sort((a, b) => order(a.get('createdAt')) - order(b.get('createdAt')) || String(a.get('name')).localeCompare(b.get('name')))
          .map((d) => ({
            id: d.id,
            name: d.get('name'),
            planId: d.get('planId') ?? null,
            muscles: d.get('muscles') ?? [],
            exercises: (d.get('exercises') ?? []).map(readRoutineExercise),
          })),
      })
      track('routines', pendingDocs(snap), snap.metadata.fromCache)
    }),
    onSnapshot(col(uid, 'sessions'), meta, (snap: QuerySnapshot) => {
      set({
        sessions: snap.docs
          .map((d) => {
            const x = d.data({ serverTimestamps: 'none' })
            return {
              id: d.id,
              date: x.date,
              start: x.start,
              end: x.end,
              routineId: x.routineId ?? null,
              planId: x.planId ?? null,
              title: x.title,
              muscles: x.muscles ?? [],
              exercises: (x.exercises ?? []).map(readLoggedExercise),
              deviceId: x.deviceId,
              syncedAt: ms(x.syncedAt),
              at: toMs(x.date, x.start),
              durationSec: durationSec(x.start, x.end),
            }
          })
          .sort((a, b) => b.at - a.at),
      })
      track('sessions', pendingDocs(snap), snap.metadata.fromCache)
    }),
    onSnapshot(col(uid, 'modifiers'), meta, (snap: QuerySnapshot) => {
      const custom: Modifier[] = snap.docs.map((d) => ({ id: d.id, label: d.get('label'), group: 'custom', custom: true }))
      set({ modifiers: [...BUILT_IN_MODIFIERS, ...custom] })
      track('modifiers', pendingDocs(snap), snap.metadata.fromCache)
    }),
    onSnapshot(col(uid, 'exercises'), meta, (snap: QuerySnapshot) => {
      const custom: Exercise[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.get('name'),
        muscle: d.get('muscle'),
        secondary: d.get('secondary') ?? [],
        description: d.get('description') ?? null,
        custom: true,
      }))
      set({ exercises: [...BUILT_IN, ...custom].sort((a, b) => a.name.localeCompare(b.name)) })
      track('exercises', pendingDocs(snap), snap.metadata.fromCache)
    }),
    onSnapshot(col(uid, 'slots'), meta, (snap: QuerySnapshot) => {
      set({
        slots: snap.docs
          .map((d) => {
            const x = d.data()
            const timed = typeof x.start === 'string' && typeof x.end === 'string' // both-or-neither; anything else reads as untimed
            return {
              id: d.id,
              date: x.date,
              start: timed ? x.start : null,
              end: timed ? x.end : null,
              routineId: x.routineId ?? null,
              title: x.title ?? null,
              sessionId: x.sessionId ?? null,
              planId: x.planId ?? null,
              generated: !!x.generated,
              at: toMs(x.date, timed ? x.start : '00:00'),
            }
          })
          .sort((a, b) => a.at - b.at),
      })
      track('slots', pendingDocs(snap), snap.metadata.fromCache)
    }),
    // not tracked: each device's own heartbeat writes would make the sync badge flicker
    onSnapshot(col(uid, 'devices'), (snap) =>
      set({
        devices: snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: 'previous' })
          return { id: d.id, name: x.name, type: x.type, lastSyncedAt: ms(x.lastSyncedAt) }
        }),
      }),
    ),
  )

  uploadLegacy(uid)
  checkScheduleImport(uid)
  heartbeat()
}

/**
 * Read-only peek at the schedule app's document: does it still hold gym data its migration hasn't moved?
 * Sisu never writes there. Used to avoid offering starter routines that would sit next to the real ones.
 */
async function checkScheduleImport(uid: string) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'apps', 'schedule'))
    const events = (snap.get('events') ?? {}) as Record<string, { kind?: string }[]>
    const hasGym = Object.values(events).some((day) => day?.some((e) => e.kind === 'gym'))
    set({ importPending: !snap.get('gymMigrated') && (((snap.get('workouts') as unknown[])?.length ?? 0) > 0 || hasGym) })
  } catch {
    // offline or no schedule app: nothing to wait for
  }
}

/**
 * Uploads workouts logged on this device before Firebase existed. Sessions only ever add documents,
 * so this can't clash with routines migrated from the schedule app. The batch is queued, so it works offline.
 */
function uploadLegacy(uid: string) {
  type LegacySession = { id: string; routine: string; date: number; durationSec: number; exercises: ExerciseLog[] }
  let legacy: { sessions?: LegacySession[] } | null
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null')
  } catch {
    legacy = null
  }
  if (legacy?.sessions?.length) {
    // ponytail: one batch (500-write cap); legacy data is a handful of test workouts
    const batch = writeBatch(db)
    for (const s of legacy.sessions) {
      const start = s.date - s.durationSec * 1000
      batch.set(doc(col(uid, 'sessions'), s.id), {
        date: ymd(start),
        start: hm(start),
        end: hm(s.date),
        routineId: null,
        planId: null,
        title: s.routine,
        muscles: [],
        exercises: s.exercises.map((e) => ({ exerciseId: idForName(e.name), name: e.name, sets: e.sets.filter((x) => x.done !== false).map(({ weight, reps }) => ({ weight, reps })) })),
        deviceId,
        syncedAt: serverTimestamp(),
      })
    }
    batch.commit().catch(fail)
  }
  localStorage.removeItem(LEGACY_KEY)
}

/**
 * Records "everything from this device was in the cloud at <server time>".
 * Waits for every queued write to be acknowledged first, so it only fires once the device is truly caught up.
 */
let beating = false
let dirty = false
async function heartbeat() {
  dirty = true
  if (beating) return
  beating = true
  try {
    while (dirty) {
      dirty = false
      await waitForPendingWrites(db) // waits as long as the device is offline
    }
  } catch {
    return // signed out while waiting
  } finally {
    beating = false
  }
  if (!state.user) return
  setDoc(doc(col(me(), 'devices'), deviceId), { name: deviceName(), type: deviceType, lastSyncedAt: serverTimestamp() }, { merge: true }).catch(fail)
}

/* ---------- actions ---------- */

function setActive(active: Active | null) {
  set({ active })
  if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active))
  else localStorage.removeItem(ACTIVE_KEY)
}

/** the most recent logged set for an exercise, shown as a hint while you log the next one */
export const lastSet = (exerciseId: string) =>
  state.sessions.find((s) => s.exercises.some((e) => e.exerciseId === exerciseId))?.exercises.find((e) => e.exerciseId === exerciseId)?.sets.at(-1)

export const startSession = (r: Routine, slotId: string | null = null) =>
  setActive({
    routineId: r.id,
    routine: r.name,
    muscles: r.muscles,
    slotId,
    startedAt: Date.now(),
    exercises: r.exercises.map((e) => {
      const targets = e.sets.length ? e.sets : [{ repsMin: 10, repsMax: 10 }]
      // empty, never pre-filled: a set you tick must hold what you actually lifted
      return { exerciseId: e.exerciseId, name: e.name, targets, sets: targets.map(() => ({ weight: 0, reps: 0, done: false })) }
    }),
  })

const editActive = (fn: (a: Active) => Active) => state.active && setActive(fn(state.active))

export const editSet = (ei: number, si: number, patch: Partial<SetLog>) =>
  editActive((a) => ({
    ...a,
    exercises: a.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...patch } : x)) })),
  }))

export const addSet = (ei: number) =>
  editActive((a) => ({
    ...a,
    exercises: a.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: [...e.sets, { weight: 0, reps: 0, done: false }] })),
  }))

export const addExercise = (exerciseId: string, name: string) =>
  editActive((a) => ({
    ...a,
    exercises: [...a.exercises, { exerciseId, name, targets: [{ repsMin: 10, repsMax: 10 }], sets: [{ weight: 0, reps: 0, done: false }] }],
  }))

export const discardSession = () => setActive(null)

/** @param end 'HH:MM' the workout actually finished; defaults to now (see Session.tsx for the long-workout prompt) */
export function finishSession(end = hm(Date.now())) {
  const a = state.active
  if (!a) return
  setActive(null)
  const exercises = a.exercises
    .map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      sets: e.sets
        .filter((x) => x.done)
        .map(({ weight, reps, rir, rpe }) => ({ weight, reps, ...(rir !== undefined && { rir }), ...(rpe !== undefined && { rpe }) })),
    }))
    .filter((e) => e.sets.length)
  if (!exercises.length) return // nothing logged, nothing saved

  const date = ymd(a.startedAt)
  const id = newId()
  const batch = writeBatch(db)
  // created once, fully formed, never edited afterwards
  batch.set(doc(col(me(), 'sessions'), id), {
    date,
    start: hm(a.startedAt),
    end,
    routineId: a.routineId,
    planId: state.routines.find((r) => r.id === a.routineId)?.planId ?? null,
    title: a.routine, // snapshot: history must not change when the routine is edited later
    muscles: musclesOf(exercises), // snapshot of what was actually trained
    exercises,
    deviceId,
    syncedAt: serverTimestamp(),
  })
  // mark the plan this fulfils: the slot it started from, else the first unfulfilled one today
  const slot = state.slots.find((x) => x.id === a.slotId) ?? state.slots.find((x) => x.date === date && !x.sessionId)
  if (slot) batch.set(doc(col(me(), 'slots'), slot.id), { sessionId: id }, { merge: true })
  batch.commit().catch(fail)
  heartbeat()
}

/** Sisu only: the schedule app offers no delete. The day it fulfilled goes back to being planned. */
export function deleteSession(id: string) {
  const uid = me()
  const batch = writeBatch(db)
  batch.delete(doc(col(uid, 'sessions'), id))
  for (const s of state.slots.filter((x) => x.sessionId === id)) batch.set(doc(col(uid, 'slots'), s.id), { sessionId: null }, { merge: true })
  batch.commit().catch(fail)
  heartbeat()
}

/**
 * Slots are co-owned with the schedule app, so only ever write the fields being changed.
 * A whole-doc write would erase a `sessionId` or a time the other app set a second earlier.
 */
export function saveSlot(id: string, patch: Partial<Omit<Slot, 'id' | 'at'>>) {
  setDoc(doc(col(me(), 'slots'), id), patch, { merge: true }).catch(fail)
  heartbeat()
}

export function deleteSlot(id: string) {
  deleteDoc(doc(col(me(), 'slots'), id)).catch(fail)
  heartbeat()
}

/* ---------- weekly pattern ---------- */

/** how far ahead a plan's weekly pattern fills the calendar */
const HORIZON_DAYS = 56

/** The days a plan's weekly pattern covers, from `from` up to the horizon. Pure: the test drives this. */
export function patternDays(plan: Plan, from: string, days = HORIZON_DAYS) {
  const out: { date: string; routineId: string }[] = []
  if (!plan.schedule) return out
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    const routineId = plan.schedule[weekdayOf(date)]
    if (routineId) out.push({ date, routineId })
  }
  return out
}

/** deterministic, so generating twice overwrites instead of duplicating */
const generatedId = (planId: string, date: string) => `gen-${planId}-${date}`

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/**
 * Fill the calendar from the plan's weekly pattern: one slot per patterned day, skipping days that
 * already hold a plan, and never going back over `generatedThrough` — a day you deleted stays deleted.
 */
export function generateSlots(plan: Plan, today = ymd(Date.now())) {
  if (!plan.schedule) return
  const from = plan.generatedThrough && plan.generatedThrough >= today ? addDays(plan.generatedThrough, 1) : today
  const span = HORIZON_DAYS - daysBetween(today, from)
  if (span <= 0) return
  const days = patternDays(plan, from, span)
  const uid = me()
  const batch = writeBatch(db)
  let wrote = 0
  for (const { date, routineId } of days) {
    const id = generatedId(plan.id, date)
    if (state.slots.some((s) => s.date === date && s.id !== id)) continue // a plan is already there, by hand or from Schedule
    const end = plan.defaultStart ? addMinutes(plan.defaultStart, plan.defaultMinutes ?? 75) : null
    batch.set(doc(col(uid, 'slots'), id), { date, start: plan.defaultStart, end, routineId, title: null, sessionId: null, planId: plan.id, generated: true }, { merge: true })
    wrote++
  }
  const through = addDays(today, HORIZON_DAYS - 1)
  if (!wrote && plan.generatedThrough === through) return
  batch.set(doc(col(uid, 'plans'), plan.id), { generatedThrough: through }, { merge: true })
  batch.commit().catch(fail)
  heartbeat()
}

/** Drop the future days a pattern laid down, leaving anything planned by hand or already trained. */
function clearGenerated(planId: string | null) {
  if (!planId) return
  const uid = me()
  const today = ymd(Date.now())
  const stale = state.slots.filter((s) => s.generated && s.planId === planId && !s.sessionId && s.date >= today)
  const batch = writeBatch(db)
  for (const s of stale) batch.delete(doc(col(uid, 'slots'), s.id))
  batch.set(doc(col(uid, 'plans'), planId), { generatedThrough: null }, { merge: true })
  batch.commit().catch(fail)
  set({ slots: state.slots.filter((s) => !stale.includes(s)) }) // so a re-generate doesn't read them as "already planned"
}

/** The pattern changed: drop the untouched future days it made, then lay the new ones down. */
function applyPattern(plan: Plan) {
  clearGenerated(plan.id)
  generateSlots({ ...plan, generatedThrough: null })
}


/** Called on launch: keeps the active plan's pattern filled as the horizon moves. */
export function ensurePattern() {
  const plan = state.plans.find((p) => p.id === state.profile.activePlanId)
  if (plan?.schedule) generateSlots(plan)
}

/**
 * Everything this account owns, straight from the server, for a backup file.
 *
 * Firestore's client SDK can't discover the subcollections *of a document*, so those names are
 * listed below (from the schedule app's FIREBASE_REPORT.md §3). Everything else is enumerated:
 * the app documents, and the legacy `estado` collection, which is about to be deleted.
 *
 * A missing document is recorded as `null` and is not an error. A real failure (denied, offline)
 * throws, because a half backup that looks whole is worse than none.
 */
const SUBCOLLECTIONS: Record<string, string[]> = {
  budget: ['months'],
  trading: ['months'], // the trading app doc itself has never existed, only its months
  gym: ['routines', 'sessions', 'slots', 'devices'],
}

export async function fullBackup() {
  const uid = me()
  const data: Record<string, unknown> = {}

  // Timestamps and other Firestore types don't survive JSON on their own
  const plain = (v: unknown): unknown => {
    if (v instanceof Timestamp) return { __timestamp: v.toDate().toISOString() }
    if (Array.isArray(v)) return v.map(plain)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
    return v
  }
  const grab = async (name: string, path: string[]) => {
    const snap = await getDocsFromServer(collection(db, path[0], ...path.slice(1)))
    data[name] = Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]))
  }

  // every app document, including ones neither app knows about
  const apps = await getDocsFromServer(collection(db, 'users', uid, 'apps'))
  for (const d of apps.docs) data[`apps/${d.id}`] = plain(d.data())

  for (const app of new Set([...apps.docs.map((d) => d.id), ...Object.keys(SUBCOLLECTIONS)])) {
    if (!(`apps/${app}` in data)) data[`apps/${app}`] = null // no document, subcollections may still exist
    for (const sub of SUBCOLLECTIONS[app] ?? []) await grab(`apps/${app}/${sub}`, ['users', uid, 'apps', app, sub])
  }

  // legacy top-level collection: enumerated, not assumed, since the point is to delete it afterwards
  await grab('estado', ['estado'])

  return {
    takenAt: new Date().toISOString(),
    project: 'scheduleproject-8f615',
    uid,
    email: state.user?.email ?? null,
    note: 'Subcollection names cannot be listed from a browser, so these were assumed; everything else was enumerated.',
    assumedSubcollections: SUBCOLLECTIONS,
    data,
  }
}

export function removeDevice(id: string) {
  deleteDoc(doc(col(me(), 'devices'), id)).catch(fail)
}

/** main muscles of the exercises involved; a variant counts towards its base's muscle */
const musclesOf = (exercises: { exerciseId: string }[]): MuscleId[] => [
  ...new Set(exercises.map((e) => resolve(e.exerciseId).base.muscle)),
]

// new accounts start empty; the user opts in (auto-seeding would race the schedule app's migration)
export function seedStarterPlan() {
  const uid = me()
  const planId = newId()
  const batch = writeBatch(db)
  const routineIds = SEED_ROUTINES.map((r, i) => {
    const id = newId()
    batch.set(doc(col(uid, 'routines'), id), { name: r.name, planId, muscles: musclesOf(r.exercises), exercises: r.exercises, createdAt: Timestamp.fromMillis(Date.now() + i) })
    return id
  })
  batch.set(doc(col(uid, 'plans'), planId), { name: 'Push Pull Legs', routineIds, schedule: null, defaultStart: null, defaultMinutes: null, generatedThrough: null, createdAt: Timestamp.now() })
  batch.set(gymRef(uid), { activePlanId: planId }, { merge: true })
  batch.commit().catch(fail)
  heartbeat()
}

export function savePlan(plan: Plan) {
  const was = state.plans.find((x) => x.id === plan.id)
  const patternChanged = JSON.stringify([was?.schedule, was?.defaultStart, was?.defaultMinutes]) !== JSON.stringify([plan.schedule, plan.defaultStart, plan.defaultMinutes])
  const saved: Plan = { ...plan, name: plan.name.trim(), generatedThrough: patternChanged ? null : plan.generatedThrough }
  setDoc(
    doc(col(me(), 'plans'), plan.id),
    {
      name: saved.name,
      routineIds: saved.routineIds,
      schedule: saved.schedule,
      defaultStart: saved.defaultStart,
      defaultMinutes: saved.defaultMinutes,
      generatedThrough: saved.generatedThrough,
      ...(!was && { createdAt: Timestamp.now() }),
    },
    { merge: true },
  ).catch(fail)
  if (patternChanged) applyPattern(saved)
  heartbeat()
}

/** The routines survive: they just stop belonging to a plan. */
export function deletePlan(id: string) {
  const uid = me()
  const batch = writeBatch(db)
  clearGenerated(id)
  batch.delete(doc(col(uid, 'plans'), id))
  for (const r of state.routines.filter((r) => r.planId === id)) batch.set(doc(col(uid, 'routines'), r.id), { planId: null }, { merge: true })
  if (state.profile.activePlanId === id) batch.set(gymRef(uid), { activePlanId: null }, { merge: true })
  batch.commit().catch(fail)
  heartbeat()
}

export const setActivePlan = (id: string | null) => {
  clearGenerated(state.profile.activePlanId) // the old plan's pattern stops filling days the new one wants
  setSettings({ activePlanId: id })
}

/** Custom exercises only: the built-ins live in code and are the same for everyone. */
export function saveExercise(e: Omit<Exercise, 'custom'>) {
  setDoc(doc(col(me(), 'exercises'), e.id), { name: e.name.trim(), muscle: e.muscle, secondary: e.secondary, description: e.description?.trim() || null }, { merge: true }).catch(fail)
  heartbeat()
}

/** The user's own modifiers. They can't change the muscle either, and they read in brackets. */
export function saveModifier(id: string, label: string) {
  setDoc(doc(col(me(), 'modifiers'), id), { label: label.trim() }, { merge: true }).catch(fail)
  heartbeat()
}

export function deleteModifier(id: string) {
  deleteDoc(doc(col(me(), 'modifiers'), id)).catch(fail)
  heartbeat()
}

/** Past workouts keep the name they were logged with, so deleting one never rewrites history. */
export function deleteExercise(id: string) {
  deleteDoc(doc(col(me(), 'exercises'), id)).catch(fail)
  heartbeat()
}

export function saveRoutine(r: Routine) {
  const isNew = !state.routines.some((x) => x.id === r.id)
  setDoc(
    doc(col(me(), 'routines'), r.id),
    { name: r.name.trim(), planId: r.planId, muscles: musclesOf(r.exercises), exercises: r.exercises, ...(isNew && { createdAt: Timestamp.now() }) },
    { merge: true },
  ).catch(fail)
  // keep the plan's order in sync when a routine joins one
  const plan = state.plans.find((p) => p.id === r.planId)
  if (plan && !plan.routineIds.includes(r.id)) savePlan({ ...plan, routineIds: [...plan.routineIds, r.id] })
  heartbeat()
}

export function deleteRoutine(id: string) {
  const uid = me()
  const batch = writeBatch(db)
  batch.delete(doc(col(uid, 'routines'), id))
  for (const p of state.plans.filter((p) => p.routineIds.includes(id))) batch.set(doc(col(uid, 'plans'), p.id), { routineIds: p.routineIds.filter((x) => x !== id) }, { merge: true })
  batch.commit().catch(fail)
  heartbeat()
}

export function setSettings(patch: Partial<Pick<Profile, 'unit' | 'weeklyGoal' | 'effort' | 'heatmap' | 'activePlanId'>>) {
  setDoc(gymRef(me()), patch, { merge: true }).catch(fail)
  heartbeat()
}

export function renameDevice(name: string) {
  localStorage.setItem('sisu.deviceName', name)
  setDoc(doc(col(me(), 'devices'), deviceId), { name }, { merge: true }).catch(fail)
  heartbeat()
}

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
  const thisWeek = sessions.filter((x) => x.at >= week)

  // streak = consecutive days with a session, counting back from today (or yesterday)
  const days = new Set(sessions.map((x) => startOfDay(x.at)))
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
    return { from, volume: volume(sessions.filter((x) => x.at >= from && x.at < to).flatMap((x) => x.exercises)) }
  })

  // keyed by exercise id, so renaming one never splits its records
  const prs = new Map<string, { name: string; set: SetLog }>()
  for (const e of sessions.flatMap((x) => x.exercises))
    for (const set of e.sets) {
      const best = prs.get(e.exerciseId)?.set
      if (!best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) prs.set(e.exerciseId, { name: e.name, set })
    }

  const weekDays = Array.from({ length: 7 }, (_, i) => days.has(new Date(week).setDate(new Date(week).getDate() + i)))

  return {
    thisWeek: thisWeek.length,
    weekVolume: volume(thisWeek.flatMap((x) => x.exercises)),
    streak,
    weeks,
    weekDays,
    prs: [...prs.values()].sort((a, b) => b.set.weight - a.set.weight),
    totalVolume: volume(sessions.flatMap((x) => x.exercises)),
  }
}
