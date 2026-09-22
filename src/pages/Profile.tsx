import { useEffect, useState } from 'react'
import { RELEASES, VERSION } from '../changelog'
import { motion } from 'motion/react'
import { DatabaseBackup, Download, LogOut, RefreshCw, Share, Smartphone } from 'lucide-react'
import { deviceName, fullBackup, installed, renameDevice, setSettings, signOut, useStore, type Effort } from '../store'
import { Devices } from '../sync'
import { NumInput } from '../sets'
import { Sheet } from '../ui'
import { Block, btn, fmtDuration, Page, spring, Tap } from '../ui'
import { ask, tell } from '../dialog'

type InstallEvent = Event & { prompt: () => Promise<void> }

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
const label = 'text-xs font-semibold tracking-widest text-zinc-500 uppercase'

/**
 * Whether the browser is holding a newer build than the one running. The service worker takes over
 * on the next cold start, so the honest answer is "reload to get it", not "updating…".
 */
function useUpdate() {
  const [waiting, setWaiting] = useState(false)
  const [checking, setChecking] = useState(false)
  const check = async () => {
    setChecking(true)
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      reg.addEventListener('updatefound', () => setWaiting(true))
      await reg.update().catch(() => {})
      if (reg.waiting || reg.installing) setWaiting(true)
    }
    setTimeout(() => setChecking(false), 600)
  }
  useEffect(() => {
    navigator.serviceWorker?.getRegistration().then((reg) => reg && (reg.waiting || reg.installing) && setWaiting(true))
  }, [])
  return { waiting, checking, check }
}

export default function Profile() {
  const { user, profile, routines, sessions } = useStore()
  const [install, setInstall] = useState<InstallEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstall(e as InstallEvent)
    }
    addEventListener('beforeinstallprompt', onPrompt)
    return () => removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState(false)
  const update = useUpdate()

  const download = (name: string, payload: unknown) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: name }).click()
    URL.revokeObjectURL(url)
  }

  // only app data: the user object carries auth tokens and must never land in a downloaded file
  const exportData = () => download(`sisu-${new Date().toISOString().slice(0, 10)}.json`, { settings: profile, routines, sessions })

  // everything this account owns, across all the apps sharing this Firebase project
  const backup = async () => {
    setSaving(true)
    try {
      download(`firebase-backup-${new Date().toISOString().slice(0, 10)}.json`, await fullBackup())
    } catch (e) {
      tell({ title: 'Backup failed', body: `${e instanceof Error ? e.message : e}. Nothing was saved — this needs a connection.` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page subtitle="Settings" title="Profile">
<Block className="card p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-lg font-semibold text-white">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Signed in as</p>
            <p className="truncate font-display text-lg font-semibold">{user?.displayName ?? profile.name}</p>
            <p className="truncate text-sm text-zinc-500">{user?.email}</p>
          </div>
        </div>
        <Tap
          onClick={async () => (await ask({ title: 'Sign out?', body: `${user?.email ?? 'Sisu'} on this device.`, confirm: 'Sign out' })) && signOut()}
          className={`${btn.ghost} mt-4 flex w-full items-center justify-center gap-2 text-red-300`}
        >
          <LogOut size={18} /> Sign out
        </Tap>
      </Block>

      <Block className="card space-y-5 p-5">
        <div>
          <span className={label}>Units</span>
          {/* ponytail: label-only switch, stored numbers are not converted */}
          <div className="mt-2 flex rounded-2xl bg-surface-2 p-1">
            {(['kg', 'lb'] as const).map((u) => (
              <button key={u} onClick={() => setSettings({ unit: u })} className="relative flex-1 py-2.5 font-display font-semibold">
                {profile.unit === u && <motion.span layoutId="unit" transition={spring} className="absolute inset-0 rounded-xl bg-accent" />}
                <span className={`relative ${profile.unit === u ? 'text-ink' : 'text-zinc-400'}`}>{u}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Effort</span>
          <p className="mt-0.5 text-sm text-muted">{profile.effort === 'none' ? 'Not logged' : profile.effort === 'rir' ? 'Reps left in the tank' : 'How hard it felt, 1 to 10'}</p>
          <div className="mt-2 flex rounded-2xl bg-surface-2 p-1">
            {([
              ['rir', 'RIR'],
              ['rpe', 'RPE'],
              ['none', 'Off'],
            ] as [Effort, string][]).map(([id, text]) => (
              <button key={id} onClick={() => setSettings({ effort: id })} className="relative flex-1 py-2.5 font-display font-semibold">
                {profile.effort === id && <motion.span layoutId="effort" transition={spring} className="absolute inset-0 rounded-xl bg-accent" />}
                <span className={`relative ${profile.effort === id ? 'text-ink' : 'text-zinc-400'}`}>{text}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Rest timer</span>
          <p className="mt-0.5 text-sm text-muted">{profile.rest ? `${fmtDuration(profile.rest)} after every set you tick` : 'None'}</p>
          <div className="mt-2 flex items-center gap-2">
            <Tap
              onClick={() => setSettings({ rest: null })}
              className={`rounded-2xl px-4 py-3 font-display font-semibold ${profile.rest === null ? 'bg-accent text-ink' : 'bg-surface-2 text-zinc-400'}`}
            >
              None
            </Tap>
            <div className="flex flex-1 items-center gap-2">
              <NumInput
                label="Rest minutes"
                value={profile.rest === null ? undefined : Math.floor(profile.rest / 60)}
                hint="0"
                step={1}
                max={59}
                onChange={(m) => setSettings({ rest: Math.min(3599, (m ?? 0) * 60 + (profile.rest ?? 0) % 60) || null })}
              />
              <span className="font-display text-lg text-zinc-500">:</span>
              <NumInput
                label="Rest seconds"
                value={profile.rest === null ? undefined : profile.rest % 60}
                hint="00"
                step={5}
                max={59}
                onChange={(sec) => setSettings({ rest: Math.min(3599, Math.floor((profile.rest ?? 0) / 60) * 60 + (sec ?? 0)) || null })}
              />
            </div>
          </div>
        </div>
      </Block>

      <Block className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Devices</h2>
        <Devices />
        <label className="block">
          <span className={label}>This device's name</span>
          <input
            defaultValue={deviceName()}
            maxLength={32}
            onBlur={(e) => {
              const name = e.target.value.trim()
              if (name && name !== deviceName()) renameDevice(name)
            }}
            className="mt-2 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none focus:border-accent"
          />
        </label>
      </Block>

      {!installed && (
        <Block className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="font-display font-semibold">Install</p>
              <p className="text-sm text-muted">Full screen, offline</p>
            </div>
          </div>
          {install ? (
            <Tap onClick={() => install.prompt().then(() => setInstall(null))} className={`${btn.primary} mt-4 w-full`}>
              Add to home screen
            </Tap>
          ) : (
            <p className="mt-4 flex flex-wrap items-center gap-1 rounded-2xl bg-surface-2 p-3 text-sm text-zinc-400">
              {ios ? (
                <>
                  Tap <Share size={14} className="text-accent" /> Share, then <b className="text-white">Add to Home Screen</b>.
                </>
              ) : (
                <>
                  Open the browser menu and choose <b className="text-white">Install app</b>.
                </>
              )}
            </p>
          )}
        </Block>
      )}

      <Block className="space-y-3">
        <Tap onClick={exportData} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
          <Download size={18} /> Export workouts
        </Tap>
        <Tap onClick={backup} disabled={saving} className={`${btn.ghost} flex w-full items-center justify-center gap-2 disabled:opacity-50`}>
          <DatabaseBackup size={18} /> {saving ? 'Reading…' : 'Download full backup'}
        </Tap>
        <p className="px-1 text-xs text-muted">Everything in this Firebase project, straight from the server.</p>
      </Block>

      <Block className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={label}>Version</p>
            <p className="font-display text-lg font-semibold">{VERSION}</p>
          </div>
          <Tap onClick={() => setNotes(true)} className={`${btn.ghost} shrink-0 px-4 py-2.5 text-sm`}>
            What's new
          </Tap>
        </div>
        {update.waiting ? (
          <Tap onClick={() => location.reload()} className={`${btn.primary} mt-4 flex w-full items-center justify-center gap-2`}>
            <RefreshCw size={16} /> Reload to update
          </Tap>
        ) : (
          <Tap onClick={update.check} disabled={update.checking} className={`${btn.ghost} mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-50`}>
            <RefreshCw size={16} className={update.checking ? 'animate-spin' : ''} /> {update.checking ? 'Checking…' : 'Check for updates'}
          </Tap>
        )}
      </Block>

      <Block className="pt-6 text-center">
        <p className="font-display text-2xl font-bold tracking-tight text-zinc-700">SISU</p>
        <p className="text-xs text-zinc-600">Strength of will. Determination. Grit.</p>
      </Block>

      <Sheet open={notes} onClose={() => setNotes(false)} title="What's new">
        <div className="space-y-5 pb-6">
          {RELEASES.map((r) => (
            <div key={r.version}>
              <p className="flex items-baseline gap-2">
                <span className="font-display font-semibold">{r.version}</span>
                {r.version === VERSION && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent uppercase">running</span>}
                <span className="text-xs text-zinc-600">{new Date(`${r.date}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {r.changes.map((c) => (
                  <li key={c} className="flex gap-2 text-sm text-zinc-400">
                    <span className="text-zinc-600">—</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}
