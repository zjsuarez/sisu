// Click "Download full backup" in the real UI and inspect the file it produces.
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'

const out = resolve(process.argv[2] ?? 'tests/.out') // absolute: chrome profiles and downloads need it
mkdirSync(out, { recursive: true })
const dir = `${out}/backupcheck`
const dl = `${out}/downloads`
rmSync(dir, { recursive: true, force: true })
rmSync(dl, { recursive: true, force: true })
mkdirSync(dl, { recursive: true })
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
const FS = 'http://127.0.0.1:8080/v1/projects/demo-sisu/databases/(default)/documents'
const rest = (path, init = {}) =>
  fetch(`${FS}/${path}`, { ...init, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json', ...init.headers } }).then((r) => r.json())

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9801', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' })
let ws
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const page = (await (await fetch('http://127.0.0.1:9801/json')).json()).find((t) => t.type === 'page')
    ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  } catch { ws = null; await sleep(250) }
}
let id = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id) pending.get(msg.id)?.(msg.result ?? msg.error)
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
    console.log('  CONSOLE', msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value

await send('Runtime.enable')
await send('Page.enable')
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl.replace(/\//g, '\\') })
await send('Page.navigate', { url: 'http://localhost:4173/' })
await sleep(2500)
await ev('window.__signIn()')
await sleep(3000)
const uid = await ev("JSON.parse(localStorage[Object.keys(localStorage).find(k => k.startsWith('firebase:authUser'))]).uid")

// gym data
await ev("location.hash = '#/workouts'")
await sleep(1200)
await ev("[...document.querySelectorAll('button')].find(b => b.textContent.replace(/\\s+/g,' ').trim() === 'Start with Push / Pull / Legs')?.click()")
await sleep(2500)

// pretend the schedule app and the money app already hold data
await rest(`users/${uid}/apps/schedule`, {
  method: 'PATCH',
  body: JSON.stringify({ fields: { wage: { doubleValue: 12.5 }, shifts: { mapValue: { fields: { '2026-09-14': { arrayValue: { values: [{ mapValue: { fields: { start: { stringValue: '09:00' }, end: { stringValue: '17:00' } } } }] } } } } } } }),
})
await rest(`users/${uid}/apps/budget/months/2026-09`, {
  method: 'PATCH',
  body: JSON.stringify({ fields: { tx: { mapValue: { fields: { '2026-09-02': { arrayValue: { values: [{ mapValue: { fields: { amount: { doubleValue: 42.9 }, note: { stringValue: 'Groceries' } } } }] } } } } } } }),
})
// a subcollection whose parent document has never existed
await rest(`users/${uid}/apps/trading/months/2026-08`, {
  method: 'PATCH',
  body: JSON.stringify({ fields: { tx: { mapValue: { fields: { '2026-08-10': { arrayValue: { values: [{ mapValue: { fields: { instrument: { stringValue: 'EURUSD' }, result: { doubleValue: -18.5 } } } }] } } } } } } }),
})
// an app neither agent knows about
await rest(`users/${uid}/apps/notes`, { method: 'PATCH', body: JSON.stringify({ fields: { hello: { stringValue: 'from a future app' } } }) })
// the legacy top-level collection, with more than the one id we used to hardcode
await rest('estado/yo', { method: 'PATCH', body: JSON.stringify({ fields: { legacy: { booleanValue: true } } }) })
await rest('estado/otro', { method: 'PATCH', body: JSON.stringify({ fields: { legacy: { stringValue: 'second doc' } } }) })
await sleep(800)

await ev("location.hash = '#/profile'")
await sleep(1500)
console.log('  click:', await ev("(() => { const b = [...document.querySelectorAll('button')].find(b => /Download full backup/.test(b.textContent)); if (!b) return 'NOT FOUND'; b.click(); return 'clicked' })()"))
await sleep(6000)

const files = readdirSync(dl).filter((f) => f.endsWith('.json'))
check('a backup file was downloaded', files.length === 1, files.join(', '))
if (files.length) {
  const backup = JSON.parse(readFileSync(`${dl}/${files[0]}`, 'utf8'))
  check('file is named for the day', /^firebase-backup-\d{4}-\d{2}-\d{2}\.json$/.test(files[0]), files[0])
  check('records who and when', !!backup.takenAt && backup.uid === uid && backup.project === 'scheduleproject-8f615')
  check("includes the schedule app's document", backup.data['apps/schedule']?.wage === 12.5, JSON.stringify(backup.data['apps/schedule'] ?? null).slice(0, 80))
  check('includes a money month', !!backup.data['apps/budget/months']?.['2026-09']?.tx, Object.keys(backup.data['apps/budget/months'] ?? {}).join(','))
  check('includes gym routines', Object.keys(backup.data['apps/gym/routines'] ?? {}).length === 3, String(Object.keys(backup.data['apps/gym/routines'] ?? {}).length))
  check('timestamps survive as readable dates', JSON.stringify(backup.data['apps/gym/routines']).includes('__timestamp'))
  check('estado is enumerated, not assumed to hold one document', Object.keys(backup.data['estado'] ?? {}).length === 2, Object.keys(backup.data['estado'] ?? {}).join(','))
  check('an app nobody hardcoded is still backed up', backup.data['apps/notes']?.hello === 'from a future app')
  check('a subcollection with no parent document is captured', !!backup.data['apps/trading/months']?.['2026-08'], Object.keys(backup.data['apps/trading/months'] ?? {}).join(','))
  check('a missing document is recorded as absent, not a failure', 'apps/trading' in backup.data && backup.data['apps/trading'] === null)
  check('records which subcollection names were assumed', !!backup.assumedSubcollections?.gym)
  check('no auth token anywhere in the file', !JSON.stringify(backup).match(/accessToken|refreshToken|apiKey/i))
}
proc.kill()
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
