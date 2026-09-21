import { Pause, Play, RotateCcw } from 'lucide-react'
import { setChrono, type Chrono } from './store'
import { fmtDuration, Tap } from './ui'

/**
 * The workout's stopwatch: yours to start, counts up, never nags. It lives with the active
 * workout, so it is the same clock in the list and in zen, and it survives closing the app.
 */
export function Chronometer({ chrono, now, compact = false }: { chrono: Chrono; now: number; compact?: boolean }) {
  const elapsed = Math.round((chrono.base + (chrono.startedAt ? now - chrono.startedAt : 0)) / 1000)
  const toggle = () => setChrono(chrono.startedAt ? { base: chrono.base + (Date.now() - chrono.startedAt), startedAt: null } : { ...chrono, startedAt: Date.now() })
  const btn = compact ? 'size-10' : 'size-12' // written out: Tailwind cannot see a class built at runtime

  return (
    <div className={`flex items-center justify-center ${compact ? 'gap-4' : 'gap-6'}`}>
      <p className={`font-display font-bold tabular-nums ${compact ? 'text-3xl' : 'text-5xl'}`}>{fmtDuration(elapsed)}</p>
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
