import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Download, LogOut, Minus, Plus, Share, Smartphone } from 'lucide-react'
import { deviceName, installed, renameDevice, setSettings, signOut, useStore } from '../store'
import { Devices } from '../sync'
import { Block, btn, Page, spring, Tap } from '../ui'

type InstallEvent = Event & { prompt: () => Promise<void> }

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
const label = 'text-xs font-semibold tracking-widest text-zinc-500 uppercase'

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

  // only app data: the user object carries auth tokens and must never land in a downloaded file
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ settings: profile, routines, sessions }, null, 2)], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: `sisu-${new Date().toISOString().slice(0, 10)}.json` }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <Page subtitle="Settings" title="Profile">
<Block className="card p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-volt to-emerald-400 font-display text-lg font-bold text-ink">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Signed in as</p>
            <p className="truncate font-display text-lg font-semibold">{user?.displayName ?? profile.name}</p>
            <p className="truncate text-sm text-zinc-500">{user?.email}</p>
          </div>
        </div>
        <Tap
          onClick={() => confirm(`Sign out of ${user?.email ?? 'Sisu'} on this device?`) && signOut()}
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
                {profile.unit === u && <motion.span layoutId="unit" transition={spring} className="absolute inset-0 rounded-xl bg-volt" />}
                <span className={`relative ${profile.unit === u ? 'text-ink' : 'text-zinc-400'}`}>{u}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className={label}>Weekly goal</p>
            <p className="text-sm text-zinc-400">Workouts per week</p>
          </div>
          <div className="flex items-center gap-3">
            <Tap aria-label="Decrease goal" onClick={() => setSettings({ weeklyGoal: Math.max(1, profile.weeklyGoal - 1) })} className="grid size-10 place-items-center rounded-full bg-surface-2">
              <Minus size={16} />
            </Tap>
            <motion.span key={profile.weeklyGoal} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-6 text-center font-display text-2xl font-bold">
              {profile.weeklyGoal}
            </motion.span>
            <Tap aria-label="Increase goal" onClick={() => setSettings({ weeklyGoal: Math.min(7, profile.weeklyGoal + 1) })} className="grid size-10 place-items-center rounded-full bg-surface-2">
              <Plus size={16} />
            </Tap>
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
            className="mt-2 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none focus:border-volt"
          />
        </label>
      </Block>

      {!installed && (
        <Block className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-volt/10 text-volt">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="font-display font-semibold">Install Sisu</p>
              <p className="text-sm text-zinc-500">Full screen, offline, on your home screen.</p>
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
                  Tap <Share size={14} className="text-volt" /> Share, then <b className="text-white">Add to Home Screen</b>.
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

      <Block>
        <Tap onClick={exportData} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
          <Download size={18} /> Export my data
        </Tap>
      </Block>

      <Block className="pt-6 text-center">
        <p className="font-display text-2xl font-bold tracking-tight text-zinc-700">SISU</p>
        <p className="text-xs text-zinc-600">Strength of will. Determination. Grit.</p>
      </Block>
    </Page>
  )
}
