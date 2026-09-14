# Unified Firebase schema: Sisu + Schedule

**Status: draft v2.1** (v2 plus the flag fix in §4 step 1). v1 was written by the Sisu agent (`gymapp-b5`) and reviewed by the schedule agent (`schedule-d6`). This version includes all five of that review's changes and its answers.
**Waiting on the user:** D1 and D1b (§7). Nothing gets implemented on either side until those are approved.

Project `scheduleproject-8f615`, database `(default)`.

---

## 1. Conventions (whole project)

| Topic | Rule |
|---|---|
| Per-user root | Everything under `users/{uid}/apps/{appId}`. No document at `users/{uid}`: the name comes from the Google account. |
| Ownership | Each fact has exactly one app that writes it. Other apps only read it. No app ever writes another app's documents. **Only exception:** the one-time Schedule → gym migration (§4) writes `apps/gym/routines` and `apps/gym/sessions` once. |
| Calendar facts | `date: 'YYYY-MM-DD'`, `start`/`end: 'HH:MM'`, local time, no time zone. `end < start` means it crosses midnight. |
| Machine instants | Firestore `Timestamp`. Use `serverTimestamp()` when "when did the server get it" matters. |
| IDs | `crypto.randomUUID()`. Fixed strings only for app docs (`schedule`, `budget`, `trading`, `gym`) and documented conventions (`pay:YYYY-MM-DD`). |
| Naming | Fields camelCase, collections plural English. Existing cosmetic oddities (`pequeno`, `tx`, `cat`) stay, and new code doesn't copy them. |
| Writes to app docs | Always `setDoc(ref, patch, { merge: true })`. Per-entry docs with one owner (e.g. a session) may be written whole. |
| Derived data | Not stored. Intentional snapshots are marked **snapshot** below, with the reason. |
| Queries | None needed. Listen to whole docs/collections and sort on the client, so no composite indexes. |

---

## 2. `apps/gym` (owner: Sisu)

```
users/{uid}/apps/gym                     { unit: 'kg'|'lb', weeklyGoal: number }
users/{uid}/apps/gym/routines/{id}       { name, muscles: MuscleId[], exercises: RoutineExercise[], createdAt?: Timestamp }
users/{uid}/apps/gym/sessions/{id}       { date, start, end, routineId: string|null, title, muscles: MuscleId[],
                                           exercises: LoggedExercise[], deviceId, syncedAt: Timestamp }
users/{uid}/apps/gym/devices/{deviceId}  { name, type: 'phone'|'desktop', lastSyncedAt: Timestamp }
users/{uid}/apps/gym/programs/{id}       shape depends on D1 (§7)
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

**Devices**
- **Owner:** each device writes only its own doc.
- **`lastSyncedAt`** is the server time at which that device had no unsent writes.
- **"Last workout from this device"** is derived from `sessions[].deviceId`, not stored.

---

## 3. Changes in Schedule (owner: Schedule)

- **Reads:** the Gym and General views read `apps/gym/sessions` (whole-collection listener), grouped into `{ 'YYYY-MM-DD': [...] }` by `date`.
- **Counting rule, so nothing is counted twice:** gym hours, week/month stats, muscle stats and the General "trained" chip count **sessions only**.
  - A gym slot (`events[kind='gym']`) is drawn as *planned* and is never counted.
  - A slot on a day that has a session is shown as done, via the session.
- **Muscle stats** read `sessions[].muscles` directly.
- **`schedule.workouts`** is no longer read or written after the migration. The WorkoutLibrary UI is removed.
- **If D1 = A and D1b = time-only:**
  - Slots are `{ id, kind: 'gym', start, end }`. Schedule stops writing `workoutId`/`title` on new slots.
  - Past days take their label from `sessions[].title`.
  - Existing future slots keep their `workoutId` harmlessly, since nothing reads it.
  - Schedule needs no routines listener.
- `plan` events are unchanged.

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
   - **Nothing to migrate** (no `workouts`, no gym events before today): still set `gymMigrated: true`, with one merge write, and stop.
   - **Why:** skipping without the flag lets today's and future slots turn into sessions once they become past days. That would hit every new user and anyone whose only gym events are upcoming.
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
5. **Gym events dated today or later:** stay as slots if D1 = A. The D1 = B plan is in §7.

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

## 7. Decisions for the user

**D1: who owns planned training days?**

A logged session (done) and a planned gym slot (intent) are different facts, so they can have different owners.

- **Option A: Schedule owns *when*, Sisu owns *what*.** Both agents recommend this.
  - You place gym slots on the calendar around your shifts, as today.
  - Sisu shows today's slot and suggests the next routine in your rotation.
  - Sisu programs become a rotation plus progression, not a fixed weekday split.
  - A past slot with no session shows as missed.
- **Option B: Sisu owns both.**
  - A Sisu program says which days you train (e.g. Mon/Wed/Fri at 19:00).
  - Schedule derives upcoming gym blocks from programs and stops writing gym events.
  - Both apps need the same "program → dates" expansion.
  - It fights a rota that changes week to week.

**D1b, only if A: do calendar slots name a routine?**
- **Time-only (recommended):**
  - A slot is just "gym 19:00–20:15". Sisu decides which routine, so "which routine on Thursday" has one owner.
  - **Cost:** you can't pick "Push" for a date in the calendar anymore. That happens in Sisu.
- **Slot keeps a routine:** you pick the routine in the calendar, and Sisu follows it. Then Sisu has no rotation of its own.

**Good to know:**
- After the migration, gym logged **only** in Schedule shows as a planned slot that never counts as trained. Workouts count once they're logged in Sisu, which uses the same Google login.

---

## 8. Resolved in review

| Question | Resolution |
|---|---|
| iOS sign-in timeout | Don't copy it. Test an offline cold start on a real iPhone (§5). |
| Muscle snapshot on sessions | Accepted. Schedule reads `sessions[].muscles`. |
| Where the migration lives | Schedule, as one transaction, flag `gymMigrated` in `apps/schedule` (§4). |
| `workoutId` on slots | Recommended: time-only. User decides (D1b). |
| Double counting | Sessions only (§3). |
