# Sisu

A gym tracker built as an installable web app (PWA). Add it to your phone's home screen and it runs full screen and works offline, like a native app.

**Stack:** React 19 · Vite · TypeScript · Tailwind CSS 4 · Motion (Framer Motion) · React Router · Lucide icons · vite-plugin-pwa

## Features

- **Today:** next routine suggestion, weekly goal ring, streak, weekly volume, recent workouts
- **Workouts:** Push/Pull/Legs to start, plus create/edit/delete your own routines
- **Live session:** log weight × reps per set, rest timer (vibrates on Android), add sets/exercises, running timer. Weights carry over to the next session
- **Progress:** weekly volume chart, personal records, full history
- **Profile:** name, kg/lb, weekly goal, install prompt, export JSON, reset

## Offline

Sisu is built to work at the gym with no signal. After the first visit, everything runs without a connection, including cold starts from the home-screen icon.

- The service worker precaches the whole app: JS, CSS, HTML, icons, and fonts. Fonts are self-hosted with `@fontsource`, not a CDN.
- All data lives on the device in `localStorage`, and the app asks for persistent storage so the browser doesn't evict it.
- Nothing in the app makes network requests. Keep it that way: any new asset has to be bundled, and any future sync has to be optional.
- Updates install in the background the next time you open the app online.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the build (service worker active)
```

To try it on your phone over wifi, run `npm run dev -- --host` and open the network URL. Installing to the home screen needs HTTPS, so use the deployed site for that.

## Deploy (GitHub Pages)

1. On GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes to `https://<user>.github.io/sisu/`.

## Install on your phone

- **iPhone (Safari):** Share → *Add to Home Screen*
- **Android (Chrome):** menu → *Install app*, or the button on the Profile tab

## Structure

```
src/
  store.ts        state, actions, stats (localStorage-backed)
  ui.tsx          shared motion primitives: Page, Block, Tap, Ring, Counter, Sheet
  App.tsx         routes + animated tab bar
  pages/          Today, Workouts, Session, Progress, Profile
public/           app icons + favicon
```
