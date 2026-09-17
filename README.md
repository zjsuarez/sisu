# Sisu

A gym tracker you install on your phone. It logs workouts at the gym with no signal, and syncs to your other devices when there is one.

**Stack:** React 19 · Vite · TypeScript · Tailwind CSS 4 · Motion · React Router · Lucide · vite-plugin-pwa · Firebase (Auth + Firestore)

Live at [sisu-lac.vercel.app](https://sisu-lac.vercel.app).

## Features

- **Today:** today's planned workout, weekly goal ring, streak, weekly volume, recent workouts, and this device's sync state
- **Plan:** planned workouts with day, time and routine — shared with the schedule app, so either one can plan
- **Workouts:** your routines, with muscles and exercises; Push/Pull/Legs to start from
- **Live session:** weight × reps per set, rest timer (vibrates on Android), add sets and exercises mid-workout, running clock. Weights carry over from your last session of that exercise
- **Progress:** weekly volume, personal records, full history with where and when each workout synced
- **Profile:** account, kg/lb, weekly goal, devices, install prompt, exports

## Offline

It has to work at the gym with no signal, including opening the app cold.

- The service worker precaches the whole app: JS, CSS, HTML, icons and fonts. Fonts are self-hosted with `@fontsource`, never a CDN.
- Firestore keeps a persistent local copy. Everything reads from it, and writes queue there and upload by themselves the next time the app is open with a connection.
- The workout in progress is kept on the device only, so a half-logged session never leaves the phone.
- The app asks for persistent storage so the browser doesn't evict your data.
- Signing in needs a connection the first time on each device; after that the session is restored offline.

**Keep it that way:** any new asset has to be bundled, and no feature may depend on being online.

## Data

Sisu shares a Firebase project with the owner's schedule app. All of its data lives under `users/{uid}/apps/gym`, and it never writes another app's documents. The agreed layout, the conventions both apps follow, and the migration plan are in **[FIREBASE_SCHEMA.md](FIREBASE_SCHEMA.md)** — read it before changing anything about storage.

Two rules that are easy to break:
- **Dates:** anything that lands on a calendar day is a local `'YYYY-MM-DD'` / `'HH:MM'` string, never a Timestamp. Timestamps are only for machine instants (`syncedAt`, `lastSyncedAt`).
- **Weights** are stored in kg. kg/lb is a display unit.

Security rules and indexes are owned by the schedule app's repo, not this one.

## Develop

```bash
npm install
npm run dev              # http://localhost:5173, against the real Firebase project
npm run build            # production build in dist/
npm run preview          # serve the build, service worker active
npm run lint
```

### Tests

End-to-end, driving the real UI in headless Chrome against the Firebase emulators. Needs Java 21 for the emulators.

```bash
npm run emulators                              # terminal 1: auth + firestore
npm run build:emulators && npm run preview     # terminal 2
npm run test:e2e                               # terminal 3
npm run test:backup
```

`test:e2e` covers sign-in, a plan created by the schedule app showing up here, logging a workout offline, reopening the app offline, auto-upload on reconnect, the plan being marked done without clobbering the other app's fields, and a second device seeing the workout. `test:backup` checks the full backup file.

Emulator builds expose `window.__signIn()` so tests can sign in without Google's consent screen. It does not exist in production builds.

## Deploy

Vercel, on push to `main`. `vercel.json` proxies `/__/auth/*` to Firebase so Google sign-in is first-party on this domain, which is what makes it work in an iPhone home-screen app. The service worker is told to leave `/__/` alone.

A new domain needs three things: the Vercel project, the domain added to Firebase → Authentication → Authorized domains, and `https://<domain>/__/auth/handler` added to the Google OAuth client's redirect URIs.

## Install on your phone

- **iPhone (Safari):** Share → *Add to Home Screen*
- **Android (Chrome):** menu → *Install app*, or the button on the Profile tab

## Structure

```
src/
  firebase.ts     app init, auth, Firestore with the persistent cache, emulator wiring
  store.ts        state, actions, Firestore paths, stats, backup
  ui.tsx          shared motion primitives: Page, Block, Tap, Ring, Counter, Sheet
  sync.tsx        sync badge and device list
  slots.tsx       planned workouts
  App.tsx         routes, sign-in gate, animated tab bar
  pages/          SignIn, Today, Workouts, Session, Progress, Profile
tests/            end-to-end suites (emulators)
public/           icons
```
