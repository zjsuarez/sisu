import { useSyncExternalStore } from 'react'
import { getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
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

// Schema: FIREBASE_SCHEMA.md (shared with the schedule app)

export const MUSCLES = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  core: 'Core', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', cardio: 'Cardio',
} as const
export type MuscleId = keyof typeof MUSCLES
export const muscleLabel = (ids: MuscleId[]) => ids.map((m) => MUSCLES[m] ?? m).join(' · ')

export type SetLog = { weight: number; reps: number; done?: boolean }
export type ExerciseLog = { name: string; sets: SetLog[] }
export type RoutineExercise = { name: string; sets: number; reps: number; weight: number }
export type Routine = { id: string; name: string; muscles: MuscleId[]; exercises: RoutineExercise[] }
export type Session = {
  id: string
  date: string // 'YYYY-MM-DD' local
  start: string // 'HH:MM' local
  end: string
  routineId: string | null
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
  start: string
  end: string
  routineId: string | null
  title: string | null
  sessionId: string | null // set when a logged workout fulfils this slot; null = still planned
  at: number // derived: local ms of date + start
}
export type Active = { routineId: string; routine: string; muscles: MuscleId[]; startedAt: number; exercises: ExerciseLog[]; slotId: string | null }
export type Profile = { name: string; unit: 'kg' | 'lb'; weeklyGoal: number }
export type Sync = { waiting: number; inSync: boolean; online: boolean; error: string | null }
export type State = {
  user: User | null | undefined // undefined while the saved sign-in is being restored
  authError: string | null
  profile: Profile
  routines: Routine[]
  sessions: Session[]
  slots: Slot[]
  devices: Device[]
  active: Active | null // in-progress workout: device-only, never synced
  /** the schedule app still holds gym data that its migration hasn't moved yet */
  importPending: boolean
  sync: Sync
}

export const LIBRARY = [
  'Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raise', 'Tricep Pushdown',
  'Deadlift', 'Barbell Row', 'Pull-up', 'Lat Pulldown', 'Bicep Curl', 'Face Pull',
  'Back Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunge', 'Leg Curl', 'Calf Raise',
  'Hip Thrust', 'Plank', 'Cable Crunch',
]

const ex = (name: string, sets: number, reps: number, weight: number): RoutineExercise => ({ name, sets, reps, weight })

const SEED_ROUTINES: Omit<Routine, 'id'>[] = [
  { name: 'Push', muscles: ['chest', 'shoulders', 'triceps'], exercises: [ex('Bench Press', 4, 8, 60), ex('Overhead Press', 3, 8, 40), ex('Incline Dumbbell Press', 3, 10, 22), ex('Tricep Pushdown', 3, 12, 25)] },
  { name: 'Pull', muscles: ['back', 'biceps'], exercises: [ex('Deadlift', 3, 5, 100), ex('Pull-up', 3, 8, 0), ex('Barbell Row', 3, 8, 60), ex('Bicep Curl', 3, 12, 12)] },
  { name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'], exercises: [ex('Back Squat', 4, 6, 80), ex('Romanian Deadlift', 3, 10, 70), ex('Leg Press', 3, 12, 140), ex('Calf Raise', 4, 15, 40)] },
]

const DEFAULT_SETTINGS = { unit: 'kg' as const, weeklyGoal: 4 }

export const newId = () => crypto.randomUUID()

/* ---------- weight ---------- */
// Stored in kg always, so switching the unit relabels nothing and history stays true.
const LB_PER_KG = 2.2046226218
export const toKg = (v: number, unit: Profile['unit']) => (unit === 'kg' ? v : v / LB_PER_KG)
export const fromKg = (kg: number, unit: Profile['unit']) => (unit === 'kg' ? Math.round(kg * 100) / 100 : Math.round(kg * LB_PER_KG * 2) / 2)

/* ---------- local dates (same convention as the schedule app: local strings, no time zone) ---------- */

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const hm = (t: number) => {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const toMs = (date: string, time: string) => {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}
const toMin = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
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
  routines: [],
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
const col = (uid: string, name: 'routines' | 'sessions' | 'slots' | 'devices') => collection(db, 'users', uid, 'apps', 'gym', name)
const me = () => state.user?.uid ?? '' // actions are only reachable after sign-in

const ms = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : null)

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
    routines: [],
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
      set({ profile: { name: firstName(user), unit: snap.get('unit') ?? DEFAULT_SETTINGS.unit, weeklyGoal: snap.get('weeklyGoal') ?? DEFAULT_SETTINGS.weeklyGoal } })
      track('gym', snap.metadata.hasPendingWrites ? 1 : 0, snap.metadata.fromCache)
    }),
    onSnapshot(col(uid, 'routines'), meta, (snap: QuerySnapshot) => {
      // no query, sorted here: routines migrated from the schedule app have no createdAt and go last
      const order = (c: unknown) => ms(c) ?? Infinity
      set({
        routines: snap.docs
          .sort((a, b) => order(a.get('createdAt')) - order(b.get('createdAt')) || String(a.get('name')).localeCompare(b.get('name')))
          .map((d) => ({ id: d.id, name: d.get('name'), muscles: d.get('muscles') ?? [], exercises: d.get('exercises') ?? [] })),
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
              title: x.title,
              muscles: x.muscles ?? [],
              exercises: x.exercises ?? [],
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
    onSnapshot(col(uid, 'slots'), meta, (snap: QuerySnapshot) => {
      set({
        slots: snap.docs
          .map((d) => {
            const x = d.data()
            return { id: d.id, date: x.date, start: x.start, end: x.end, routineId: x.routineId ?? null, title: x.title ?? null, sessionId: x.sessionId ?? null, at: toMs(x.date, x.start) }
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
        title: s.routine,
        muscles: SEED_ROUTINES.find((r) => r.name === s.routine)?.muscles ?? [],
        exercises: s.exercises.map((e) => ({ name: e.name, sets: e.sets.filter((x) => x.done !== false).map(({ weight, reps }) => ({ weight, reps })) })),
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

// the most recent logged set for an exercise, so a new workout starts where the last one ended
const lastSet = (name: string) => state.sessions.find((s) => s.exercises.some((e) => e.name === name))?.exercises.find((e) => e.name === name)?.sets.at(-1)

export const startSession = (r: Routine, slotId: string | null = null) =>
  setActive({
    routineId: r.id,
    routine: r.name,
    muscles: r.muscles,
    slotId,
    startedAt: Date.now(),
    exercises: r.exercises.map((e) => {
      const last = lastSet(e.name)
      return { name: e.name, sets: Array.from({ length: e.sets }, () => ({ weight: last?.weight ?? e.weight, reps: last?.reps ?? e.reps, done: false })) }
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
    exercises: a.exercises.map((e, i) => {
      if (i !== ei) return e
      const last = e.sets.at(-1) ?? { weight: 0, reps: 10 }
      return { ...e, sets: [...e.sets, { ...last, done: false }] }
    }),
  }))

export const addExercise = (name: string) =>
  editActive((a) => ({ ...a, exercises: [...a.exercises, { name, sets: [{ weight: 0, reps: 10, done: false }] }] }))

export const discardSession = () => setActive(null)

/** @param end 'HH:MM' the workout actually finished; defaults to now (see Session.tsx for the long-workout prompt) */
export function finishSession(end = hm(Date.now())) {
  const a = state.active
  if (!a) return
  setActive(null)
  const exercises = a.exercises
    .map((e) => ({ name: e.name, sets: e.sets.filter((x) => x.done).map(({ weight, reps }) => ({ weight, reps })) }))
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
    title: a.routine, // snapshot: history must not change when the routine is edited later
    muscles: a.muscles, // snapshot, same reason
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

/**
 * Everything this account owns, straight from the server, for a backup file.
 * The client SDK can't discover subcollections, so the paths are listed here; they come from
 * the schedule app's FIREBASE_REPORT.md §3. Any read failure aborts: a half backup that looks
 * whole is worse than none.
 */
export async function fullBackup() {
  const uid = me()
  const docs: [string, string[]][] = [
    ['apps/schedule', ['users', uid, 'apps', 'schedule']],
    ['apps/budget', ['users', uid, 'apps', 'budget']],
    ['apps/trading', ['users', uid, 'apps', 'trading']],
    ['apps/gym', ['users', uid, 'apps', 'gym']],
    ['estado/yo', ['estado', 'yo']], // legacy single-user doc, kept until it's deleted
  ]
  const cols: [string, string[]][] = [
    ['apps/budget/months', ['users', uid, 'apps', 'budget', 'months']],
    ['apps/trading/months', ['users', uid, 'apps', 'trading', 'months']],
    ['apps/gym/routines', ['users', uid, 'apps', 'gym', 'routines']],
    ['apps/gym/sessions', ['users', uid, 'apps', 'gym', 'sessions']],
    ['apps/gym/slots', ['users', uid, 'apps', 'gym', 'slots']],
    ['apps/gym/devices', ['users', uid, 'apps', 'gym', 'devices']],
  ]

  // Timestamps and other Firestore types don't survive JSON on their own
  const plain = (v: unknown): unknown => {
    if (v instanceof Timestamp) return { __timestamp: v.toDate().toISOString() }
    if (Array.isArray(v)) return v.map(plain)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
    return v
  }

  const data: Record<string, unknown> = {}
  for (const [name, path] of docs) {
    const snap = await getDocFromServer(doc(db, path[0], path[1], ...path.slice(2)))
    data[name] = snap.exists() ? plain(snap.data()) : null
  }
  for (const [name, path] of cols) {
    const snap = await getDocsFromServer(collection(db, path[0], path[1], ...path.slice(2)))
    data[name] = Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]))
  }
  return { takenAt: new Date().toISOString(), project: 'scheduleproject-8f615', uid, email: state.user?.email ?? null, data }
}

export function removeDevice(id: string) {
  deleteDoc(doc(col(me(), 'devices'), id)).catch(fail)
}

// new accounts start empty; the user opts in to starter routines (auto-seeding would race the schedule migration)
export function seedRoutines() {
  SEED_ROUTINES.forEach((r, i) => setDoc(doc(col(me(), 'routines'), newId()), { ...r, createdAt: Timestamp.fromMillis(Date.now() + i) }).catch(fail))
  heartbeat()
}

export function saveRoutine(r: Routine) {
  const isNew = !state.routines.some((x) => x.id === r.id)
  setDoc(doc(col(me(), 'routines'), r.id), { name: r.name, muscles: r.muscles, exercises: r.exercises, ...(isNew && { createdAt: Timestamp.now() }) }, { merge: true }).catch(fail)
  heartbeat()
}

export function deleteRoutine(id: string) {
  deleteDoc(doc(col(me(), 'routines'), id)).catch(fail)
  heartbeat()
}

export function setSettings(patch: Partial<Pick<Profile, 'unit' | 'weeklyGoal'>>) {
  setDoc(gymRef(me()), patch, { merge: true }).catch(fail)
  heartbeat()
}

export function renameDevice(name: string) {
  localStorage.setItem('sisu.deviceName', name)
  setDoc(doc(col(me(), 'devices'), deviceId), { name }, { merge: true }).catch(fail)
  heartbeat()
}

/* ---------- derived stats ---------- */

export const volume = (exercises: ExerciseLog[]) =>
  exercises.reduce((t, e) => t + e.sets.reduce((s, x) => s + (x.done !== false ? x.weight * x.reps : 0), 0), 0)

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
