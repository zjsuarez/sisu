// End-to-end: real UI -> Firebase emulators. Covers sign-in, a slot created by "the schedule app",
// logging a workout offline, a cold reload offline, and a second device seeing it once back online.
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const out = resolve(process.argv[2] ?? 'tests/.out') // absolute: chrome profiles and downloads need it
mkdirSync(out, { recursive: true })
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const APP = 'http://localhost:4173/'
const FS = 'http://127.0.0.1:8080/v1/projects/demo-sisu/databases/(default)/documents'
let UID = 'unknown' // filled in after sign-in: Firebase assigns its own uid
// Both the emulators and a built app must be running: npm run emulators, then npm run build:emulators && npm run preview
for (const [what, url] of [['the Firestore emulator', 'http://127.0.0.1:8080/'], ['the auth emulator', 'http://127.0.0.1:9099/'], ['the app', 'http://localhost:4173/']]) {
  try {
    await fetch(url)
  } catch {
    console.error(`Can't reach ${what} at ${url}.\n\n  npm run emulators\n  npm run build:emulators && npm run preview\n`)
    process.exit(2)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)
let failures = 0
const check = (name, ok, detail = '') => {
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

// --- Firestore emulator REST (Bearer owner bypasses rules)
const rest = async (path, init = {}) => {
  const r = await fetch(`${FS}/${path}`, { ...init, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json', ...init.headers } })
  return r.status === 404 ? null : r.json()
}
const listDocs = async (col) => (await rest(`users/${UID}/apps/gym/${col}`))?.documents ?? []
const plain = (doc) =>
  Object.fromEntries(
    Object.entries(doc.fields ?? {}).map(([k, v]) => [k, v.stringValue ?? (v.nullValue === null ? null : (v.timestampValue ?? v.integerValue ?? v.booleanValue ?? v.arrayValue ?? v.mapValue))]),
  )

async function launch(port, profile) {
  const dir = `${out}/${profile}`
  rmSync(dir, { recursive: true, force: true })
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' })
  let ws
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    } catch { ws = null; await sleep(250) }
  }
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id) pending.get(msg.id)?.(msg.result ?? msg.error)
    if (msg.method === 'Runtime.exceptionThrown') log('  EXCEPTION', msg.params.exceptionDetails.exception?.description?.split('\n')[0])
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
      log('  CONSOLE ERROR', msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 220))
  }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value
  const shot = async (name) => writeFileSync(`${out}/${name}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  const offline = (state) => send('Network.emulateNetworkConditions', { offline: state, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  return { proc, send, ev, shot, offline }
}

const click = (text) => `(() => {
  const b = [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)})
  if (!b) return 'NOT FOUND: ' + ${JSON.stringify(text)}
  b.click()
  return 'clicked'
})()`
const body = `document.body.innerText`

// ---------------------------------------------------------------- phone
const phone = await launch(9501, 'phone')
await phone.send('Page.navigate', { url: APP })
await sleep(2500)
check('sign-in screen shown when signed out', (await phone.ev(body)).includes('Continue with Google'))

await phone.ev('window.__signIn()')
await sleep(3000)
check('signed in, app shown', (await phone.ev(body)).includes('Planned'))
UID = await phone.ev("JSON.parse(localStorage[Object.keys(localStorage).find(k => k.startsWith('firebase:authUser'))]).uid")
log('  uid:', UID)

// starter routines (that button lives on the Workouts tab)
await phone.ev("location.hash = '#/workouts'")
await sleep(1500)
log('  click:', await phone.ev(click('Start with Push / Pull / Legs')))
await sleep(3000)
const routines = await listDocs('routines')
check('starter routines saved to Firestore', routines.length === 3, `${routines.length} routines`)
if (!routines.length) { log(await phone.ev(body)); process.exit(1) }
const push = routines.map(plain).find((r) => r.name === 'Push')
check('routine carries muscles for the schedule app', (push?.muscles?.values?.length ?? 0) > 0, JSON.stringify(push?.muscles ?? {}).slice(0, 120))
await phone.ev("location.hash = '#/'")
await sleep(1200)

// --- the schedule app plans a workout for today (written straight to the shared collection)
const today = new Date()
const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const realPushId = routines.find((d) => plain(d).name === 'Push').name.split('/').pop()
await rest(`users/${UID}/apps/gym/slots/slot-from-schedule`, {
  method: 'PATCH',
  body: JSON.stringify({
    fields: { date: { stringValue: ymd }, start: { stringValue: '19:00' }, end: { stringValue: '20:15' }, routineId: { stringValue: realPushId }, title: { nullValue: null }, sessionId: { nullValue: null } },
  }),
})
await sleep(2500)
const afterSlot = await phone.ev(body)
check("today's plan from the schedule app appears in Sisu", afterSlot.includes('19:00') && afterSlot.includes('Push'))
await phone.shot('e2e-today')

// ---------------------------------------------------------------- offline workout
await phone.offline(true)
await sleep(1500)
await phone.ev(click('Start workout'))
await sleep(1800)
await phone.ev(`document.querySelectorAll('[aria-label="Complete set"]')[0].click()`)
await sleep(500)
await phone.ev(`document.querySelectorAll('[aria-label="Complete set"]')[0].click()`)
await sleep(1200)
await phone.shot('e2e-session-offline')
await phone.ev(click('Finish'))
await sleep(2500)
const offlineBody = await phone.ev(body)
check('offline: workout shows in the app straight away', offlineBody.includes('Recent') && offlineBody.includes('Push'))
check('offline: badge says it is waiting to upload', /waiting to upload/i.test(offlineBody), offlineBody.split('\n').find((l) => /waiting|Offline|Synced/i.test(l)))
check('offline: nothing reached the server yet', (await listDocs('sessions')).length === 0)
await phone.shot('e2e-offline-today')

// cold reload with no network
await phone.send('Page.reload')
await sleep(4000)
const reloaded = await phone.ev(body)
check('offline: app reopens from cache, still signed in', !reloaded.includes('Continue with Google') && reloaded.includes('Push'))

// ---------------------------------------------------------------- back online
await phone.offline(false)
await sleep(6000)
const sessions = (await listDocs('sessions')).map(plain)
check('reconnect: the workout uploaded by itself', sessions.length === 1, `${sessions.length} sessions`)
check('session has the schedule app date format', sessions[0]?.date === ymd && /^\d{2}:\d{2}$/.test(sessions[0]?.start ?? ''), JSON.stringify({ date: sessions[0]?.date, start: sessions[0]?.start, end: sessions[0]?.end }))
const slot = plain((await rest(`users/${UID}/apps/gym/slots/slot-from-schedule`)) ?? {})
check('the plan is marked as done, not missed', !!slot.sessionId && slot.sessionId !== null)
check("the plan's time and routine were not overwritten", slot.start === '19:00' && slot.routineId === realPushId, JSON.stringify({ start: slot.start, end: slot.end }))
const devices = (await listDocs('devices')).map(plain)
check('device registered with a last-synced time', devices.some((d) => d.type === 'phone' && d.lastSyncedAt), JSON.stringify(devices))
const onlineBody = await phone.ev(body)
check('badge shows synced', /Synced/.test(onlineBody), onlineBody.split('\n').find((l) => /waiting|Offline|Synced/i.test(l)))

// ---------------------------------------------------------------- second device (desktop)
const desktop = await launch(9502, 'desktop')
await desktop.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
await desktop.send('Page.navigate', { url: APP })
await sleep(2500)
await desktop.ev('window.__signIn()')
await sleep(5000)
const deskBody = await desktop.ev(body)
check('second device sees the workout logged on the phone', deskBody.includes('Push') && /Recent/.test(deskBody))
await sleep(3000)
const devices2 = (await listDocs('devices')).map(plain)
check(
  'phone and desktop both listed, each with its own kind',
  devices2.some((d) => d.type === 'phone') && devices2.some((d) => d.type === 'desktop'),
  devices2.map((d) => `${d.name}/${d.type}`).join(', '),
)
await desktop.shot('e2e-desktop')

phone.proc.kill()
desktop.proc.kill()
log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
