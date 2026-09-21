# Unified Firebase schema: Sisu + Schedule

**Status: draft v4.3** (Sisu now writes the parts of v4 it had only declared: untimed slots, `planId`/`generated` on generated days, plus two fields of its own). v4.2 added `apps/gym/modifiers` and variant exercise ids; both invisible to the schedule app. Previously v4.1 — v4 plus the three rules the schedule agent asked to have pinned down (times are both-or-neither, sessions always have times, editing a generated slot un-generates it). v4 was v3.1 plus the app the user actually specified: an exercise library, plans, per-set rep targets, effort (RIR/RPE), and optional times on a planned day. v1-v3 were written by the Sisu agent (`gymapp-ab`) and reviewed by the schedule agent across four rounds; v3.1 is what is deployed and working today.

**What v4 changes, and who it touches:**
- **Breaking for the schedule app:** a planned day may now have **no time** (`start`/`end` are nullable). The user's default is "no assigned time".
- **Additive, invisible to the schedule app:** `plans`, `exercises`, per-set rep targets on routines, per-set effort on sessions, `planId`/`generated` on slots.
- **Unchanged:** everything the schedule app reads today — `sessions[].date/start/end/title/muscles`, `routines[].name`, `slots[].date/routineId/title/sessionId`, and the sessions-only counting rule.

Project `scheduleproject-8f615`, database `(default)`.

---

## 1. Conventions (whole project)

| Topic | Rule |
|---|---|
| Per-user root | Everything under `users/{uid}/apps/{appId}`. No document at `users/{uid}`: the name comes from the Google account. |
| Ownership | Each fact lives in exactly one place. Most collections have a single writing app; others only read them. **Two exceptions:** `apps/gym/slots` is co-owned (both apps create, edit and delete slots, one document each, so writes cannot clobber each other), and the one-time Schedule to gym migration (§4) writes `apps/gym/routines`, `apps/gym/sessions` and `apps/gym/slots` once. |
| Calendar facts | `date: 'YYYY-MM-DD'`, `start`/`end: 'HH:MM'`, local time, no time zone. `end < start` means it crosses midnight. |
| Machine instants | Firestore `Timestamp`. Use `serverTimestamp()` when "when did the server get it" matters. |
| IDs | `crypto.randomUUID()`. Fixed strings only for app docs (`schedule`, `budget`, `trading`, `gym`) and documented conventions (`pay:YYYY-MM-DD`). |
| Naming | Fields camelCase, collections plural English. Existing cosmetic oddities (`pequeno`, `tx`, `cat`) stay, and new code doesn't copy them. |
| Writes to app docs | Always `setDoc(ref, patch, { merge: true })`. Per-entry docs with one owner (e.g. a session) may be written whole. |
| Writes to `slots` | **Field-level only** (`{ merge: true }` with just the fields being changed), never a whole-document write. The two apps touch different fields of the same slot: Sisu writes `sessionId` when a workout is done, while the calendar may be editing the time. A whole-doc write erases the other's field, and a completed workout would silently show as missed. |
| Derived data | Not stored. Intentional snapshots are marked **snapshot** below, with the reason. |
| Queries | None needed. Listen to whole docs/collections and sort on the client, so no composite indexes. |

---

## 2. `apps/gym` (owner: Sisu)

```
users/{uid}/apps/gym                     { unit: 'kg'|'lb', weeklyGoal: number, effort: 'rir'|'rpe'|'none',
                                           heatmap: 'time'|'sets'|'volume'|'plain', activePlanId: string|null }
users/{uid}/apps/gym/exercises/{id}      { name, muscle: MuscleId, secondary: MuscleId[], description: string|null }
users/{uid}/apps/gym/modifiers/{id}      { label }                                  <- the user's own modifiers
users/{uid}/apps/gym/plans/{id}          { name, routineIds: string[], schedule: WeeklySchedule|null,
                                           defaultStart: 'HH:MM'|null, defaultMinutes: number|null,
                                           generatedThrough: 'YYYY-MM-DD'|null, createdAt: Timestamp }
users/{uid}/apps/gym/routines/{id}       { name, planId: string|null, muscles: MuscleId[],
                                           exercises: RoutineExercise[], createdAt?: Timestamp }
users/{uid}/apps/gym/sessions/{id}       { date, start, end, routineId: string|null, planId: string|null, title,
                                           muscles: MuscleId[], exercises: LoggedExercise[], deviceId, syncedAt: Timestamp }
users/{uid}/apps/gym/slots/{id}          { date, start: 'HH:MM'|null, end: 'HH:MM'|null, routineId: string|null,
                                           title: string|null, sessionId: string|null,
                                           planId: string|null, generated: boolean }      <- co-owned, both apps
users/{uid}/apps/gym/devices/{deviceId}  { name, type: 'phone'|'desktop', lastSyncedAt: Timestamp }
```

```ts
type MuscleId = 'chest'|'back'|'shoulders'|'biceps'|'triceps'|'forearms'|'core'|'quads'|'hamstrings'|'glutes'|'calves'|'cardio'
type WeeklySchedule = { mon: string|null, tue: string|null, wed: string|null, thu: string|null, fri: string|null, sat: string|null, sun: string|null }  // routine id per weekday
type RoutineExercise = { exerciseId: string, name: string, sets: { repsMin: number, repsMax: number }[] }
type LoggedSet = { weight: number, reps: number, rir?: number, rpe?: number }   // weight in kg
type LoggedExercise = { exerciseId: string, name: string, sets: LoggedSet[] }
```

### Field notes

**`apps/gym` doc**
- May not exist; every reader falls back to defaults (`kg`, `4`, `rir`, no active plan).
- `effort` decides what the session logger asks for. It's a display/input setting, never a rewrite of history — see sets.
- `activePlanId` — exactly one plan is active at a time (the user's decision). Switching plans clears the previous plan's unfulfilled generated days, so two patterns never fight over the same week.
- `heatmap` — which measure shades Sisu's year grid (Calendar tab). Display only, nothing else reads it.

**Exercises and modifiers**
- **An exercise id may be a variant**: `bench-press~dumbbell+2ct-pause` is a base id, `~`, then modifier ids joined by `+`, in a fixed order so the same set of modifiers always produces the same id. A variant is never stored anywhere; it has its own history because logged sets point at ids. Rules and the catalogue: `CATALOGUE.md`.
- **Modifiers never change the muscle.** A variant counts towards its base's muscle, so muscle summaries are unaffected.
- `apps/gym/modifiers` holds only the user's own modifiers (a label); the built-in ones live in Sisu's code.
- **Ids written before the re-cut still resolve** through an alias table (`chin-up` → `pull-up~supinated`), so old routines and logged workouts keep working.
- This collection holds the **user's own** exercises. The built-in catalogue ships in Sisu's code with stable ids (`bench-press`, `back-squat`, …); a custom exercise gets a uuid. Ids are what sets point at, so renaming an exercise never splits its history.
- `muscle` is the main muscle and is required, from the 12 the schedule app already uses. `secondary` is optional and does **not** count towards muscle summaries, or every press would read as a shoulder day.
- A custom exercise can be deleted. Sessions keep the `name` they were logged with, so history survives it.

**Plans**
- A plan is a name, its routines, and **either a weekly pattern or nothing**. Rotations and N-day cycles were considered and dropped: they need an anchor date, re-projection, and pinning to survive manual edits, and they make the shared calendar rewrite itself.
- `schedule: null` = the plan is just a set of routines. You plan individual days by hand, in either app. This is the user's own case, since their shifts rotate weekly.
- A weekly pattern generates real slot documents 8 weeks ahead, topped up whenever Sisu opens, so the schedule app stays a dumb reader. Regeneration only ever touches **future** slots with `generated: true` and no `sessionId`. Slots created in either app by hand, and generated slots that were later edited, both carry `generated: false` and are never overwritten.
- `defaultStart`/`defaultMinutes` may be null: "no assigned time", which is the default.
- `generatedThrough` is the last date the pattern has filled. It only moves forward, so deleting a generated day doesn't resurrect it on the next launch. Changing the pattern resets it to null and re-lays the future days.

**Routines**
- `muscles` is derived from the main muscles of its exercises when the routine is saved. It stays stored because the schedule app reads it and because it keeps the document self-describing.
- `sets` is one entry per set, each with a rep range. A fixed target is a range with both ends equal (10-10), so a set never changes shape when you switch between "10" and "8-10".
- No target weight: the logger suggests what you actually lifted last time for that exercise.

**Sessions**
- **`date`, `start` and `end` are always present.** A logged workout is a real block in time: the chronometer never produces a session without them. This is the counting path (hours, week and month stats), so a null here would be silent rather than loud.
- Written once, fully formed, never edited. Deleting one is allowed **in Sisu only** (the accidental-start case); the schedule app offers no delete. That's a UI rule, not a database permission: both apps sign in as the same user.
- Deleting a session clears `sessionId` on the slot it fulfilled, so that day goes back to planned.
- **Effort is stored with its kind** (`rir` or `rpe`, never a bare number), so switching the setting later can't silently change what past numbers meant. Absent = not recorded.
- `title` and `muscles` are snapshots of the routine at workout time: editing a routine must not rewrite history.
- `exercises[].name` is likewise a snapshot, next to the `exerciseId` that links it to the library.

**Slots (planned workouts)**
- **Co-owned:** both apps create, edit and delete them, one document each. **Field-level writes only** (`{merge:true}` with just the changed fields): Sisu writes `sessionId` when a workout is done while the calendar may be editing the time, and a whole-document write would erase one of them, silently turning a finished workout into a missed one.
- **Untimed is now valid.** `start`/`end` are null when the user hasn't assigned a time.
- **Times are both-or-neither.** Either both are `'HH:MM'` or both are `null`. A start with no end has no duration, so there is nothing to draw in a calendar grid and no sane fallback. Anything else is a bug, and a reader may treat it as untimed.
- **Editing a generated slot un-generates it.** Whichever app changes a slot's time, routine or day sets `generated: false` in the same patch. After that no regeneration will touch it, so a day you moved by hand survives a change to the plan. There is no separate "edited" flag to keep in sync.
- **Horizon:** a weekly plan is materialised at most **8 weeks ahead**, rolling: Sisu tops it up when it opens. Nothing generates a year of dashed days into a collection the other app reads on every cold load.
- `routineId` may be null (plain "gym"); `title` is the label only when there's no routine, and stays null when `routineId` is set.
- `sessionId` links the plan to the workout that fulfilled it: the slot the workout started from, else the earliest unfulfilled slot the same day. **Missed** = a past slot whose `sessionId` is still null; it is derived, never stored.
- `planId` + `generated` say where the slot came from, so a weekly pattern can be regenerated without destroying days you placed by hand.
- **Generated slots use a derived id**, `gen-{planId}-{date}` (the one documented exception to random ids): re-running a pattern overwrites the same document instead of racing itself into duplicates. Every other slot keeps a uuid.
- **Growth:** one document per planned workout, roughly 200 a year. Fulfilled past slots are dead weight, but deleting them on completion risks a zombie document if the other app writes the same slot moments later. If it ever matters, prune fulfilled slots older than 30 days.

**Devices**
- Each device writes only its own doc. `lastSyncedAt` is the server time at which it had no unsent writes. "Last workout from this device" is derived from `sessions[].deviceId`.

## 3. Changes in Schedule (owner: Schedule)

- **Reads:** the Gym and General views read `apps/gym/sessions` (whole-collection listener), grouped into `{ 'YYYY-MM-DD': [...] }` by `date`.
- **Counting rule, so nothing is counted twice:** gym hours, week/month stats, muscle stats and the General "trained" chip count **sessions only**.
  - A slot (`apps/gym/slots`) is drawn as *planned* and is never counted.
  - A slot whose `sessionId` is set is shown as done, via the session it points to.
- **Muscle stats** read `sessions[].muscles` directly.
- **Planned gym moves out of `events`.** `events[kind='gym']` is retired completely. The calendar reads `apps/gym/slots` and writes there too, one document per slot, so planning still happens in the calendar exactly as today, including picking the routine.
- **Routine picker:** Schedule listens to `apps/gym/routines` to offer the routine list when creating a slot. `schedule.workouts` and its WorkoutLibrary UI are removed after the migration; routines are edited in Sisu.
- **Labels:** a past day takes its label from `sessions[].title`, a future day from the slot's routine name or `title`.
- `events[kind='plan']` is unchanged.

---

## 4. Migration: gym data from Schedule into `apps/gym`

**Where it runs:** in the **Schedule app**, per uid, on sign-in, next to its existing migrations. Schedule owns the source data, and every Schedule user runs it, including people who never open Sisu.

**Shape:** **one `runTransaction`**. It reads `apps/schedule`, and atomically writes the routines, the sessions and the `apps/schedule` cleanup.
- **No partial state:** it can't end with sessions copied but events not cleaned up, or the reverse.
- **Concurrent edits:** an edit from another device just makes it retry.
- **Offline:** it fails instead of queueing half a migration, and simply runs on the next sign-in.
- **Size:** a few dozen sessions, well within transaction limits.

**Steps:**
0. **Backup:** the user exports Firestore before this ships.
1. **Skip only if `apps/schedule.gymMigrated === true`.** The flag means "this account is past the cutover", not "had data". It lives in the source doc, next to `txMigrated` / `paysMigrated`.
   - **Nothing to migrate** = no `workouts` **and no gym events at any date** (past, today or future, since step 5 moves those too). In that case still set `gymMigrated: true`, with one merge write, and stop.
   - **Why the flag either way:** without it, today's and tomorrow's gym events become past days later and would be re-read on a future sign-in. And if the condition only looked at past events, a user whose gym events are all upcoming would get the flag set while their events stayed in `events[kind='gym']` — invisible, since the calendar no longer reads that field.
2. **Routines:** each `schedule.workouts[w]` → `apps/gym/routines/{w.id}` = `{ name: w.name, muscles: w.muscles ?? [], exercises: [] }`.
3. **Past sessions:** each gym event `e` with `date < today`, where `workout = workouts.find(w => w.id === e.workoutId)`, → `apps/gym/sessions/{e.id}` =
   ```
   { date, start: e.start, end: e.end,
     routineId: workout ? e.workoutId : null,
     title: e.title || workout?.name || 'Gym',
     muscles: workout?.muscles ?? [],
     exercises: [], deviceId: 'schedule-import', syncedAt: serverTimestamp() }
   ```
   Migrated `muscles` are the template's **current** muscles. What past workouts actually trained isn't recoverable, and that's accepted.
4. **Cleanup in `apps/schedule`, same transaction:**
   - Remove the migrated past gym events. Rewrite each affected day with its remaining events, and `deleteField()` any day left empty.
   - Remove `workouts`.
   - Set `gymMigrated: true`.
5. **Gym events dated today or later** -> `apps/gym/slots/{e.id}` = `{ date, start: e.start, end: e.end, routineId: workout ? e.workoutId : null, title: workout ? null : (e.title || null), sessionId: null }`, removed from `events` in the same transaction as step 4. `title` stays `null` when a routine is set, so it can't go stale. After the migration no gym data is left in `apps/schedule`.

**Idempotent:** target IDs are the existing uuids, and the flag stops re-runs.

**Sisu side:** no dependency on the migration or on ship order. Sisu never creates routines on its own.

---

## 5. Hosting and sign-in for Sisu

- **Vercel**, same as Schedule, with the same `vercel.json` rewrites for `/__/auth/*` and `/__/firebase/*` → `scheduleproject-8f615.firebaseapp.com`.
- **`authDomain`** = `location.hostname` outside localhost.
- **Sign-in method:** popup on a normal tab; redirect when installed or when the popup is blocked. Auth persistence is `browserLocalPersistence`.
- **No timeout-to-sign-in-screen:** Sisu must open offline with the cached user. **Unverified** until tested: a cold start offline on a real iPhone in home-screen mode. Schedule's 2026-08-27 hang predates its same-domain auth handler and has never been tested offline.
- **Service worker** must not catch `/__/`: `navigateFallbackDenylist: [/^\/__\//]`.
- **User:** adds Sisu's domain to Authorized domains, and `https://<sisu-domain>/__/auth/handler` to the Google OAuth client's redirect URIs.
- The GitHub Pages deploy is removed.

---

## 6. Security rules and indexes

- **No rule change needed now.** `match /users/{uid}/{document=**}` (owner-only) covers `apps/gym` and everything under it.
- **Owner:** the `schedule-project` repo (`firebase.json` + `.firebaserc` + `firestore.indexes.json`, CLI deploy). Sisu keeps no rules file.
- **Later hardening** (not blocking): shape validation and create-only `apps/gym/sessions`.
- **Separate, Schedule's call:** the `/estado/{doc}` read-by-any-signed-in-user leak.

---

## 7. Decided by the user (2026-09-16)

**Planning happens in both apps.** The calendar sets the day, the time and the routine; Sisu can plan too. Neither app owns planning.

**How that stays consistent:** one shared list, `apps/gym/slots`, one document per planned workout, written by both apps. The alternative both agents had proposed (each app keeping its own list) was rejected, and rightly: two lists of the same workout drift apart.

**Consequences**
- Schedule keeps its planning UI, now backed by `apps/gym/slots` instead of `events[kind='gym']`, and reads routines from `apps/gym/routines`.
- Sisu's Today shows today's slot (routine and time). With no slot for today it falls back to suggesting the least recently trained routine.
- **Counting is unchanged:** a slot is intent and never counts as trained. Only a logged session counts.
- Gym logged **only** in Schedule stays an unfulfilled slot: it shows as missed and never counts as trained. Workouts count once logged in Sisu, which uses the same Google login.

**Programs, later:** a program is a template that *generates* slots (for example a rotation across your training days). It creates ordinary slot documents that either app can then edit, so there is still one list. Not designed yet; it comes after the core works.

## 8. Resolved in review

| Question | Resolution |
|---|---|
| iOS sign-in timeout | Don't copy it. Test an offline cold start on a real iPhone (§5). |
| Muscle snapshot on sessions | Accepted. Schedule reads `sessions[].muscles`. |
| Where the migration lives | Schedule, as one transaction, flag `gymMigrated` in `apps/schedule` (§4). |
| Routine on a slot | User decided: yes. Slots carry `routineId`, and both apps can set it (§7). |
| Double counting | Sessions only (§3). |
