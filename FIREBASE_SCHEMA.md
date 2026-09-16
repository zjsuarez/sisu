# Unified Firebase schema: Sisu + Schedule

**Status: draft v3.1** — v3 plus the four fixes from `schedule-c8`'s review (migration skip condition, field-level slot writes, `title` rule, §3 wording). The user decided (§7): **both apps plan**, and a calendar slot sets day, time **and** routine. v1/v2 were written by the Sisu agent (`gymapp-b5`) and reviewed by the schedule agent (`schedule-d6`).
**New in v3:** planned workouts become one shared collection, `apps/gym/slots`, written by both apps. Reviewed and agreed by the schedule agent. Sisu's half is implemented and tested against the emulators; nothing is deployed and no real data has been touched.

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
users/{uid}/apps/gym                     { unit: 'kg'|'lb', weeklyGoal: number }
users/{uid}/apps/gym/routines/{id}       { name, muscles: MuscleId[], exercises: RoutineExercise[], createdAt?: Timestamp }
users/{uid}/apps/gym/sessions/{id}       { date, start, end, routineId: string|null, title, muscles: MuscleId[],
                                           exercises: LoggedExercise[], deviceId, syncedAt: Timestamp }
users/{uid}/apps/gym/slots/{id}          { date, start, end, routineId: string|null, title: string|null,
                                           sessionId: string|null }                   <- co-owned, both apps
users/{uid}/apps/gym/devices/{deviceId}  { name, type: 'phone'|'desktop', lastSyncedAt: Timestamp }
users/{uid}/apps/gym/programs/{id}       later: a template that generates slots (§7)
```

```ts
type MuscleId = 'chest'|'back'|'shoulders'|'biceps'|'triceps'|'forearms'|'core'|'quads'|'hamstrings'|'glutes'|'calves'|'cardio'
type RoutineExercise = { name: string, sets: number, reps: number, weight: number }   // weight = starting target
type LoggedExercise  = { name: string, sets: { weight: number, reps: number }[] }     // completed sets only
```

### Field notes

**`apps/gym` doc**
- It may not exist. Subcollection docs don't create their parent, and every reader falls back to defaults (`kg`, `4`).

**Routines**
- `createdAt` is optional and only used for ordering in Sisu. Routines migrated from Schedule don't have it and sort last.
- Sisu never creates routines on its own. A new account sees an empty state with a "Start with Push/Pull/Legs" button.

**Sessions**
- **Calendar placement:** `date`/`start` = local day and time the workout started; `end` = the time it was finished.
- **Duration:** derived from `start`/`end`, never stored.
- **`title` + `muscles` are snapshots** of the routine at workout time. A logged workout is history, like a receipt: editing or deleting the routine later must not rewrite it.
- **`routineId`** is `null` if the routine no longer exists or the session was imported without one.
- **`exercises: []`** is valid. Workouts imported from Schedule have no sets.
- **Writes:** sessions are created once, fully formed, with an ID generated on the device. Sisu never edits one afterwards.
- **`deviceId`** is the Sisu device that logged it. Imported sessions use `'schedule-import'`.
- **`syncedAt`** is `serverTimestamp()`, so it reads as `null` on the device until the server acknowledges the write. That's how the app shows "waiting to upload".

**Slots (planned workouts)**
- **Co-owned:** both apps create, edit and delete them. One document per slot, so two apps (or two devices) editing different slots never overwrite each other. Two edits to the *same* slot resolve last-write-wins, which is fine for one person.
- **That shape is the whole point:** one shared list, so a workout planned in the calendar and one planned in Sisu are the same entry. Two parallel lists would drift.
- `routineId` may be `null` (an unplanned "gym at 19:00"); `title` is the label for a slot **with no routine**, and stays `null` whenever `routineId` is set. Copying the routine name in would go stale the day the routine is renamed.
- **`sessionId`** links the plan to the workout that fulfilled it. Sisu sets it when a workout started from that slot is finished; a workout started ad hoc attaches to the earliest unfulfilled slot the same day.
- **Missed** = a slot in the past whose `sessionId` is still `null`. Nothing stores "missed"; it is derived.
- Slots are not history: deleting one is normal, and it never affects logged sessions.
- **Growth:** one document per planned workout, roughly 200 a year. Fulfilled past slots are dead weight, but deleting them on completion risks a zombie document if the other app writes the same slot moments later, and the `sessionId` link is what tells planned from ad-hoc. If it ever matters, prune fulfilled slots older than 30 days, which nothing is editing any more.

**Devices**
- **Owner:** each device writes only its own doc.
- **`lastSyncedAt`** is the server time at which that device had no unsent writes.
- **"Last workout from this device"** is derived from `sessions[].deviceId`, not stored.

---

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
