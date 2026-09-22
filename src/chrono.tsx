import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { setChrono, type Chrono } from './store'
import { fmtDuration, Tap } from './ui'

/** A clock that only ticks while something needs it. */
function useTick(on: boolean, every: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    setNow(Date.now())
    if (!on) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, every)
    document.addEventListener('visibilitychange', tick) // background tabs are throttled; catch up on return
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [on, every])
  return now
}

/** "1:23" and the hundredths apart, so the big number stays readable while they blur */
const split = (ms: number) => {
  const cs = Math.max(0, Math.floor(ms / 10))
  return { main: fmtDuration(Math.floor(cs / 100)), cs: String(cs % 100).padStart(2, '0') }
}

/**
 * The workout's stopwatch: yours to start, counts up, never nags. It lives with the active
 * workout, so it is the same clock in the list and in zen, and it survives closing the app.
 */
export function Chronometer({ chrono, compact = false }: { chrono: Chrono; compact?: boolean }) {
  const now = useTick(!!chrono.startedAt, 50) // fast enough for hundredths to read as movement
  const { main, cs } = split(chrono.base + (chrono.startedAt ? now - chrono.startedAt : 0))
  const toggle = () => setChrono(chrono.startedAt ? { base: chrono.base + (Date.now() - chrono.startedAt), startedAt: null } : { ...chrono, startedAt: Date.now() })
  const btn = compact ? 'size-10' : 'size-12' // written out: Tailwind cannot see a class built at runtime

  return (
    <div className={`flex items-center justify-center ${compact ? 'gap-4' : 'gap-6'}`}>
      <p className={`font-display font-bold tabular-nums ${compact ? 'text-3xl' : 'text-5xl'}`}>
        {main}
        <span className="text-zinc-500">.{cs}</span>
      </p>
      <Tap onClick={toggle} aria-label={chrono.startedAt ? 'Pause timer' : 'Start timer'} className={`grid ${btn} place-items-center rounded-full bg-accent text-ink`}>
        {chrono.startedAt ? <Pause size={compact ? 16 : 20} fill="currentColor" /> : <Play size={compact ? 16 : 20} fill="currentColor" />}
      </Tap>
      <Tap
        onClick={() => setChrono({ base: 0, startedAt: null })}
        aria-label="Reset timer"
        className={`grid ${btn} place-items-center rounded-full bg-surface-2 text-zinc-400`}
      >
        <RotateCcw size={compact ? 16 : 20} />
      </Tap>
    </div>
  )
}

/** The rest countdown, started by ticking a set. Only exists while it is running. */
export function RestBar({ until, total, onExtend, onSkip }: { until: number; total: number; onExtend: () => void; onSkip: () => void }) {
  const now = useTick(true, 250)
  const left = Math.max(0, Math.ceil((until - now) / 1000))

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="mb-2 overflow-hidden rounded-3xl bg-surface-2/95 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Timer size={18} className="shrink-0 text-accent" />
        <p className="flex-1 font-display text-2xl font-bold tabular-nums">{fmtDuration(left)}</p>
        <Tap onClick={onExtend} className="rounded-xl bg-surface px-3 py-2 text-sm font-medium text-zinc-300">
          +15s
        </Tap>
        <Tap onClick={onSkip} className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-ink">
          Skip
        </Tap>
      </div>
      <motion.div className="h-1 bg-accent" animate={{ width: `${(left / Math.max(total, 1)) * 100}%` }} transition={{ ease: 'linear', duration: 0.25 }} />
    </motion.div>
  )
}
