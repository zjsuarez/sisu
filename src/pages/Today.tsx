import { motion } from 'motion/react'
import { ChevronRight, Flame, Play, Timer, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fromKg, muscleLabel, startSession, stats, useStore, volume, ymd } from '../store'
import { Plan } from '../slots'
import { SyncBadge } from '../sync'
import { Block, Counter, fmtCompact, fmtDay, fmtDuration, Page, Tap } from '../ui'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening'
}

export default function Today() {
  const { profile, routines, sessions, slots, active } = useStore()
  const navigate = useNavigate()
  const st = stats(sessions)

  // today's plan wins; otherwise suggest the routine trained least recently (an empty routine is no use)
  const todaySlot = slots.find((s) => s.date === ymd(Date.now()) && !s.sessionId)
  const planned = todaySlot?.routineId ? routines.find((r) => r.id === todaySlot.routineId) : undefined
  const lastDone = (id: string) => sessions.find((s) => s.routineId === id)?.at ?? 0
  const next = planned ?? routines.filter((r) => r.exercises.length).sort((a, b) => lastDone(a.id) - lastDone(b.id))[0]

  const go = () => {
    if (!active && next) startSession(next, todaySlot?.id ?? null)
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
        <Tap onClick={() => navigate('/profile')} className="grid size-12 place-items-center rounded-full bg-surface-2 font-display text-lg font-semibold text-white">
          {profile.name.charAt(0).toUpperCase()}
        </Tap>
      }
    >
      {/* hero */}
      <Block className="card relative overflow-hidden p-6">
        <p className="relative text-xs font-semibold tracking-widest text-muted uppercase">
          {active ? 'In progress' : todaySlot ? (todaySlot.start ? `Today · ${todaySlot.start}` : 'Today') : 'Up next'}
        </p>
        <h2 className="relative mt-1 font-display text-5xl font-bold tracking-tight">{active?.routine ?? next?.name ?? 'Rest day'}</h2>
        <p className="relative mt-1 text-sm text-muted">
          {next || active ? `${(active ?? next).exercises.length} exercises${next && !active ? ` · ${muscleLabel(next.muscles)}` : ''}` : 'No routines'}
        </p>
        <Tap onClick={go} className="relative mt-6 flex items-center gap-2 rounded-2xl bg-accent px-5 py-3.5 font-display font-semibold text-ink">
          <Play size={18} fill="currentColor" /> {active ? 'Resume workout' : next ? 'Start workout' : 'Create routine'}
        </Tap>
      </Block>

      {/* stats */}
      <Block className="grid grid-cols-3 gap-3">
        {[
          { icon: Flame, label: 'Streak', value: st.streak, suffix: '' },
          { icon: Trophy, label: 'Workouts', value: sessions.length, suffix: '' },
          { icon: Timer, label: `Week ${profile.unit}`, value: fromKg(st.weekVolume, profile.unit), suffix: '' },
        ].map(({ icon: Icon, label, value, suffix }) => (
          <div key={label} className="card p-4">
            <Icon size={18} className="text-accent" />
            <p className="mt-3 font-display text-2xl font-bold">
              <Counter value={value} format={value >= 10_000 ? fmtCompact : undefined} />
              {suffix}
            </p>
            <p className="text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </Block>

      <Block>
        <Plan />
      </Block>

      {/* recent */}
      <Block>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Recent</h3>
          <Tap onClick={() => navigate('/progress')} className="flex items-center text-sm text-muted">
            All <ChevronRight size={16} />
          </Tap>
        </div>
        {sessions.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No workouts</div>
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
                <div className="grid size-11 place-items-center rounded-xl bg-surface-2 font-display font-bold text-accent">{s.title.charAt(0)}</div>
                <div className="flex-1">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-zinc-500">
                    {fmtDay(s.at)} · {fmtDuration(s.durationSec)}
                  </p>
                </div>
                <p className="font-display font-semibold">
                  {fmtCompact(fromKg(volume(s.exercises), profile.unit))}
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
