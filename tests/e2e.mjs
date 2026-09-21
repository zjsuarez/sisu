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

// start from an empty database: leftovers from a previous run would make results meaningless
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-sisu/databases/(default)/documents', { method: 'DELETE' })

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
log('  click:', await phone.ev(click('Push / Pull / Legs')))
await sleep(3000)
await phone.shot('e2e-workouts')
const routines = await listDocs('routines')
check('starter routines saved to Firestore', routines.length === 3, `${routines.length} routines`)
if (!routines.length) { log(await phone.ev(body)); process.exit(1) }
const push = routines.map(plain).find((r) => r.name === 'Push')
check('routine carries muscles for the schedule app', (push?.muscles?.values?.length ?? 0) > 0, JSON.stringify(push?.muscles ?? {}).slice(0, 120))
await phone.ev("location.hash = '#/'")
await sleep(1200)

// ---------------------------------------------------------------- plan and routine shapes
const plans = await listDocs('plans')
const planId = plans[0]?.name.split('/').pop()
check('the starter plan exists', plans.length === 1 && plain(plans[0]).name === 'Push Pull Legs', JSON.stringify(plans.map(plain)))
check('it lists its three routines', JSON.stringify(plans[0]?.fields?.routineIds ?? {}).split('stringValue').length - 1 === 3)
const gym = plain((await rest(`users/${UID}/apps/gym`)) ?? {})
check('and it is the active plan', gym.activePlanId === planId, String(gym.activePlanId))

const pushDoc = (await listDocs('routines')).find((d) => plain(d).name === 'Push')
const pushId = pushDoc.name.split('/').pop()
check('routines belong to the plan', plain(pushDoc).planId === planId)
check('targets are per-set rep ranges', JSON.stringify(pushDoc).includes('repsMin') && JSON.stringify(pushDoc).includes('repsMax'))
check('exercises carry stable ids, not just names', JSON.stringify(pushDoc).includes('bench-press'))
const setsBefore = JSON.stringify(pushDoc).split('repsMin').length - 1

// edit it through the UI: add a set to the first exercise, save
await phone.ev(`location.hash = '#/routine/${pushId}'`)
await sleep(1800)
log('  add set:', await phone.ev(click('Add set')))
await sleep(700)
await phone.shot('e2e-routine')

await sleep(600)
log('  save:', await phone.ev(click('Save routine')))
await sleep(2500)
const pushAfter = (await listDocs('routines')).find((d) => plain(d).name === 'Push')
check('editing a routine saves the new set', JSON.stringify(pushAfter).split('repsMin').length - 1 === setsBefore + 1, `${setsBefore} -> ${JSON.stringify(pushAfter).split('repsMin').length - 1}`)
// create an exercise without leaving the routine, and give another one a modifier
await phone.ev(`location.hash = '#/routine/${pushId}'`)
await sleep(1500)
await phone.ev(click('Add exercise'))
await sleep(1200)

// the picker's last sheet wins: the modifier sheet opens on top of it
const dialogEval = (body) => `(() => {
  const d = [...document.querySelectorAll('[role="dialog"]')].at(-1)
  if (!d) return 'NO DIALOG'
  ${body}
})()`
const dialogClick = (text) =>
  dialogEval(`const b = [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === ` + JSON.stringify(text) + `)
  if (!b) return 'NOT FOUND'
  b.click()
  return 'clicked'`)
const dialogClickStarts = (text) =>
  dialogEval(`const b = [...d.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(` + JSON.stringify(text) + `))
  if (!b) return 'NOT FOUND'
  b.click()
  return 'clicked'`)
const closeSheet = () => `(() => {
  const backs = [...document.querySelectorAll('.fixed.inset-0.z-40')]
  backs.at(-1)?.click()
  return backs.length
})()`

// 1. a brand new exercise, created from the picker
await phone.ev(
  dialogEval(`const input = d.querySelector('input[placeholder="Search"]')
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Sled Push')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return input.value`),
)
await sleep(600)
log('  new:', await phone.ev(dialogClick('New: Sled Push')))
await sleep(1200)
log('  muscle:', await phone.ev(dialogClick('Quads')))
await sleep(400)
log('  save exercise:', await phone.ev(dialogClick('Add exercise')))
await sleep(1200)

// 2. an existing one with a modifier on it
await phone.ev(
  dialogEval(`const input = d.querySelector('input[placeholder="Search"]')
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Lateral Raise')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return input.value`),
)
await sleep(600)
log('  pick:', await phone.ev(dialogClickStarts('Lateral Raise')))
await sleep(600)
log('  gear:', await phone.ev(dialogEval(`const b = d.querySelector('[aria-label="Modifiers for Lateral Raise"]'); if (!b) return 'NOT FOUND'; b.click(); return 'clicked'`)))
await sleep(1000)
log('  modifier:', await phone.ev(dialogClick('Cable')))
await sleep(600)
await phone.shot('e2e-modifiers')
await phone.ev(closeSheet())
await sleep(800)

const pickerBody = await phone.ev(body)
check('a modifier renames the pick before you add it', /Cable Lateral Raise/.test(pickerBody))

log('  commit:', await phone.ev(dialogClick('Add 2 exercises')))
await sleep(1200)
const withNew = await phone.ev(body)
check('both picks land in the routine', /Sled Push/.test(withNew) && /Cable Lateral Raise/.test(withNew))
log('  save:', await phone.ev(click('Save routine')))
await sleep(2500)

const customs = (await listDocs('exercises')).map(plain)
check('the new exercise is saved to the library', customs.some((e) => e.name === 'Sled Push' && e.muscle === 'quads'), JSON.stringify(customs.map((e) => e.name)))
const pushWithNew = (await listDocs('routines')).find((d) => plain(d).name === 'Push')
check('the routine keeps both after saving', JSON.stringify(pushWithNew).includes('Sled Push') && JSON.stringify(pushWithNew).includes('Cable Lateral Raise'))
check('the modifier is in the exercise id, not a second record', JSON.stringify(pushWithNew).includes('lateral-raise~cable'))

// ---------------------------------------------------------------- exercise library
await phone.ev("location.hash = '#/exercises'")
await sleep(1500)
const lib = await phone.ev(body)
check('built-in catalogue is listed', /Bench Press/.test(lib) && /Back Squat/.test(lib), lib.split('\n')[1])

// filtering narrows the list
await phone.ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Calves')?.click()`)
await sleep(800)
const filtered = await phone.ev(body)
check('filtering by muscle works', /Calf Raise/.test(filtered) && !/Bench Press/.test(filtered))
await phone.ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'All')?.click()`)
await sleep(600)

// add one of your own, through the UI
await phone.ev(`document.querySelector('[aria-label="New exercise"]').click()`)
await sleep(1200)
// React controlled inputs need the native setter, otherwise onChange never fires
await phone.ev(`(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const input = dialog.querySelector('input[placeholder="Name"]')
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Cable Pullover')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return input.value
})()`)
await sleep(400)
await phone.ev(`(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const buttons = [...dialog.querySelectorAll('button')]
  buttons.find((b) => b.textContent.trim() === 'Back').click()   // main muscle
  return true
})()`)
await sleep(400)
await phone.ev(`(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const add = [...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add exercise')
  if (!add) return 'NOT FOUND'
  add.click()
  return 'clicked'
})()`)
await sleep(2500)
const custom = (await listDocs('exercises')).map(plain)
const pullover = custom.find((e) => e.name === 'Cable Pullover')
check('a custom exercise is saved', !!pullover, JSON.stringify(custom.map((e) => e.name)))
check('it carries a main muscle from the shared list', pullover?.muscle === 'back', String(pullover?.muscle))
check('it appears in the list as yours', /Cable Pullover/.test(await phone.ev(body)))
await phone.shot('e2e-exercises')

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
await sleep(700)
const warning = await phone.ev(`(() => { const d = document.querySelector('[role="alertdialog"]'); return d ? d.innerText.replace(/\\s+/g, ' ').trim() : 'NO DIALOG' })()`)
check('finishing warns about sets that were never ticked', /not ticked/i.test(warning), warning)
check("the warning is the app's own, not the browser's", warning !== 'NO DIALOG')
await phone.ev(`(() => { const b = [...document.querySelectorAll('[role="alertdialog"] button')].at(-1); if (!b) return 'NO BUTTON'; b.click(); return 'clicked' })()`)
await sleep(2500)
const offlineBody = await phone.ev(body)
check('offline: workout shows in the app straight away', offlineBody.includes('Recent') && offlineBody.includes('Push'))
check('offline: badge says it is waiting to upload', /\d+ waiting/i.test(offlineBody), offlineBody.split('\n').find((l) => /waiting|Offline|Synced/i.test(l)))
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

// ---------------------------------------------------------------- the plan screen counts it
await phone.ev(`location.hash = '#/plan/${planId}'`)
await sleep(2000)
const planBody = await phone.ev(body)
check('the plan screen counts the workout that was logged', /1 workout/i.test(planBody), planBody.slice(0, 120))
check('and shows the routine count beside it', /3 routines/i.test(planBody))
await phone.shot('e2e-plan')
await phone.ev("location.hash = '#/workouts'")
await sleep(1500)
await phone.shot('e2e-workouts-list')

// ---------------------------------------------------------------- weekly pattern -> calendar
await phone.ev(`location.hash = '#/plan/${planId}'`)
await sleep(1500)
await phone.ev(`document.querySelector('[aria-label="Edit Push Pull Legs"]').click()`)
await sleep(1200)
log('  mon:', await phone.ev(dialogEval(`const b = d.querySelector('[aria-label="Mon"]'); if (!b) return 'NOT FOUND'; b.click(); return 'clicked'`)))
await sleep(500)
log('  thu:', await phone.ev(dialogEval(`const b = d.querySelector('[aria-label="Thu"]'); if (!b) return 'NOT FOUND'; b.click(); return 'clicked'`)))
await sleep(500)
log('  thu again:', await phone.ev(dialogEval(`d.querySelector('[aria-label="Thu"]').click(); return 'clicked'`)))
await sleep(500)
await phone.shot('e2e-weekly')
log('  save plan:', await phone.ev(dialogClick('Save')))
await sleep(3000)

const generated = (await listDocs('slots')).map(plain).filter((s) => s.generated === true)
check('the weekly pattern fills the calendar ahead', generated.length >= 8, `${generated.length} generated slots`)
check('generated days carry the plan and a routine', generated.every((s) => s.planId === planId && !!s.routineId), JSON.stringify(generated[0] ?? {}))
check('and have no time on them', generated.every((s) => s.start === null && s.end === null), JSON.stringify(generated[0] ?? {}))
const weekdays = new Set(generated.map((s) => new Date(`${s.date}T00:00`).getDay()))
check('only on the two weekdays picked', weekdays.size === 2 && [...weekdays].every((d) => d === 1 || d === 4), JSON.stringify([...weekdays]))
const firstTwo = generated.map((s) => s.routineId).filter((id, i, a) => a.indexOf(id) === i)
check('Monday and Thursday get different routines', firstTwo.length === 2, JSON.stringify(firstTwo))

await phone.ev("location.hash = '#/calendar'")
await sleep(2500)
const cal = await phone.ev(body)
check('the calendar screen opens on this month', new RegExp(new Date().toLocaleDateString('en', { month: 'long' })).test(cal), cal.slice(0, 80).split('\n').join(' | '))
check('planned days are labelled with their routine', /Push/.test(cal), cal.slice(0, 200).split('\n').join(' | '))
await phone.shot('e2e-calendar')

// a day opens its sheet, and the logged workout can be deleted from there
await phone.ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\\s+/g, ' ').trim().startsWith('${new Date().getDate()}Push'))?.click()`)
await sleep(1200)
await phone.shot('e2e-calendar-day')
check('tapping a day opens it', !!(await phone.ev(`!!document.querySelector('[role="dialog"]')`)))
await phone.ev(closeSheet())
await sleep(800)

// turning the pattern off clears the days it made
await phone.ev(`location.hash = '#/plan/${planId}'`)
await sleep(1500)
await phone.ev(`document.querySelector('[aria-label="Edit Push Pull Legs"]').click()`)
await sleep(1200)
const restDay = async (day) => {
  for (let i = 0; i < 5; i++) {
    const text = await phone.ev(dialogEval(`const b = d.querySelector('[aria-label="${day}"]'); return b ? b.textContent.trim() : 'NOT FOUND'`))
    if (text.endsWith('–')) return `${day} clear after ${i}`
    await phone.ev(dialogEval(`d.querySelector('[aria-label="${day}"]').click(); return 'clicked'`))
    await sleep(400)
  }
  return `${day} STILL SET`
}
log(' ', await restDay('Mon'))
log(' ', await restDay('Thu'))
log('  save plan:', await phone.ev(dialogClick('Save')))
await sleep(3000)
const leftovers = (await listDocs('slots')).map(plain).filter((s) => s.generated === true && !s.sessionId)
check('dropping the pattern clears the days it made', leftovers.length === 0, `${leftovers.length} left`)
const kept = (await listDocs('slots')).map(plain).filter((s) => !s.generated)
check('and leaves the ones planned by hand alone', kept.some((s) => s.start === '19:00'), JSON.stringify(kept.map((s) => s.date)))

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
