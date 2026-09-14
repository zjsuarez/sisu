import { motion } from 'motion/react'
import { ChevronRight, Flame, Play, Timer, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { muscleLabel, startSession, stats, useStore, volume } from '../store'
import { SyncBadge } from '../sync'
import { Block, Counter, fmtCompact, fmtDay, fmtDuration, Page, Ring, Tap } from '../ui'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening'
}

export default function Today() {
  const { profile, routines, sessions, active } = useStore()
  const navigate = useNavigate()
  const st = stats(sessions)

  // suggest the routine done least recently
  const lastDone = (id: string) => sessions.find((s) => s.routineId === id)?.at ?? 0
  const next = [...routines].sort((a, b) => lastDone(a.id) - lastDone(b.id))[0]

  const go = () => {
    if (!active && next) startSession(next)
    navigate(active || next ? '/session' : '/workouts')
  }

  return (
    <Page
      subtitle={
        <>
          {greeting()} <SyncBadge />
        </>
      }
      title={profile.name}
      action={
        <Tap onClick={() => navigate('/profile')} className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-volt to-emerald-400 font-display text-lg font-bold text-ink">
          {profile.name.charAt(0).toUpperCase()}
        </Tap>
      }
    >
      {/* hero */}
      <Block className="relative overflow-hidden rounded-[2rem] bg-volt p-6 text-ink">
        <motion.div
          className="absolute -top-16 -right-16 size-56 rounded-full bg-white/30 blur-2xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <p className="relative text-sm font-semibold tracking-widest uppercase opacity-60">{active ? 'In progress' : 'Up next'}</p>
        <h2 className="relative mt-1 font-display text-5xl font-bold tracking-tight">{active?.routine ?? next?.name ?? 'Rest day'}</h2>
        <p className="relative mt-1 font-medium opacity-70">
          {active
            ? `${active.exercises.length} exercises · pick up where you left off`
            : next
              ? `${next.exercises.length} exercises · ${muscleLabel(next.muscles)}`
              : 'Create a routine to get started'}
        </p>
        <Tap onClick={go} className="relative mt-6 flex items-center gap-2 rounded-2xl bg-ink px-5 py-3.5 font-display font-semibold text-volt">
          <Play size={18} fill="currentColor" /> {active ? 'Resume workout' : next ? 'Start workout' : 'Create routine'}
        </Tap>
      </Block>

      {/* weekly goal */}
      <Block className="card flex items-center gap-4 p-5">
        <Ring value={st.thisWeek / profile.weeklyGoal} size={96}>
          <div className="text-center">
            <p className="font-display text-3xl font-bold">
              {st.thisWeek}
              <span className="text-lg text-zinc-500">/{profile.weeklyGoal}</span>
            </p>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">Weekly goal</p>
          <p className="text-sm text-zinc-500">
            {st.thisWeek >= profile.weeklyGoal ? 'Crushed it. Sisu.' : `${profile.weeklyGoal - st.thisWeek} more to go this week`}
          </p>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.04, type: 'spring', stiffness: 500, damping: 25 }}
                className={`grid aspect-square place-items-center rounded-md text-[10px] font-bold ${st.weekDays[i] ? 'bg-volt text-ink' : 'bg-surface-2 text-zinc-500'}`}
              >
                {d}
              </motion.div>
            ))}
          </div>
        </div>
      </Block>

      {/* stats */}
      <Block className="grid grid-cols-3 gap-3">
        {[
          { icon: Flame, label: 'Streak', value: st.streak, suffix: 'd' },
          { icon: Trophy, label: 'Workouts', value: sessions.length, suffix: '' },
          { icon: Timer, label: `Week ${profile.unit}`, value: st.weekVolume, suffix: '' },
        ].map(({ icon: Icon, label, value, suffix }) => (
          <div key={label} className="card p-4">
            <Icon size={18} className="text-volt" />
            <p className="mt-3 font-display text-2xl font-bold">
              <Counter value={value} format={value >= 10_000 ? fmtCompact : undefined} />
              {suffix}
            </p>
            <p className="text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </Block>

      {/* recent */}
      <Block>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Recent</h3>
          <Tap onClick={() => navigate('/progress')} className="flex items-center text-sm text-zinc-400">
            All <ChevronRight size={16} />
          </Tap>
        </div>
        {sessions.length === 0 ? (
          <div className="card p-6 text-center text-sm text-zinc-500">No workouts yet. Your first one is the hardest.</div>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 4).map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="card flex items-center gap-4 p-4"
              >
                <div className="grid size-11 place-items-center rounded-xl bg-surface-2 font-display font-bold text-volt">{s.title.charAt(0)}</div>
                <div className="flex-1">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-zinc-500">
                    {fmtDay(s.at)} · {fmtDuration(s.durationSec)}
                  </p>
                </div>
                <p className="font-display font-semibold">
                  {fmtCompact(volume(s.exercises))}
                  <span className="text-xs text-zinc-500"> {profile.unit}</span>
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </Block>
    </Page>
  )
}
