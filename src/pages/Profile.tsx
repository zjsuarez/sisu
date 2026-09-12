import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Download, Minus, Plus, RotateCcw, Share, Smartphone } from 'lucide-react'
import { resetAll, setProfile, useStore } from '../store'
import { Block, btn, Page, spring, Tap } from '../ui'

type InstallEvent = Event & { prompt: () => Promise<void> }

const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function Profile() {
  const state = useStore()
  const { profile } = state
  const [install, setInstall] = useState<InstallEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstall(e as InstallEvent)
    }
    addEventListener('beforeinstallprompt', onPrompt)
    return () => removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `sisu-${new Date().toISOString().slice(0, 10)}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Page subtitle="Settings" title="Profile">
      <Block className="card space-y-5 p-5">
        <label className="block">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Name</span>
          <input
            value={profile.name}
            maxLength={24}
            onChange={(e) => setProfile({ name: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && setProfile({ name: 'Athlete' })}
            className="mt-2 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 font-display text-lg outline-none focus:border-volt"
          />
        </label>

        <div>
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Units</span>
          {/* ponytail: label-only switch, stored numbers are not converted */}
          <div className="mt-2 flex rounded-2xl bg-surface-2 p-1">
            {(['kg', 'lb'] as const).map((u) => (
              <button key={u} onClick={() => setProfile({ unit: u })} className="relative flex-1 py-2.5 font-display font-semibold">
                {profile.unit === u && <motion.span layoutId="unit" transition={spring} className="absolute inset-0 rounded-xl bg-volt" />}
                <span className={`relative ${profile.unit === u ? 'text-ink' : 'text-zinc-400'}`}>{u}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Weekly goal</p>
            <p className="text-sm text-zinc-400">Workouts per week</p>
          </div>
          <div className="flex items-center gap-3">
            <Tap aria-label="Decrease goal" onClick={() => setProfile({ weeklyGoal: Math.max(1, profile.weeklyGoal - 1) })} className="grid size-10 place-items-center rounded-full bg-surface-2">
              <Minus size={16} />
            </Tap>
            <motion.span key={profile.weeklyGoal} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-6 text-center font-display text-2xl font-bold">
              {profile.weeklyGoal}
            </motion.span>
            <Tap aria-label="Increase goal" onClick={() => setProfile({ weeklyGoal: Math.min(7, profile.weeklyGoal + 1) })} className="grid size-10 place-items-center rounded-full bg-surface-2">
              <Plus size={16} />
            </Tap>
          </div>
        </div>
      </Block>

      {!standalone && (
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

      <Block className="grid grid-cols-2 gap-3">
        <Tap onClick={exportData} className={`${btn.ghost} flex items-center justify-center gap-2`}>
          <Download size={18} /> Export
        </Tap>
        <Tap onClick={() => confirm('Erase all workouts and routines?') && resetAll()} className={`${btn.ghost} flex items-center justify-center gap-2 text-red-400`}>
          <RotateCcw size={18} /> Reset
        </Tap>
      </Block>

      <Block className="pt-6 text-center">
        <p className="font-display text-2xl font-bold tracking-tight text-zinc-700">SISU</p>
        <p className="text-xs text-zinc-600">Strength of will. Determination. Grit.</p>
      </Block>
    </Page>
  )
}
