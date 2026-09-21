import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, ChevronLeft, EllipsisVertical, Pause, Play, Plus, RotateCcw } from 'lucide-react'
import { addSet, editSet, exerciseHistory, fromKg, lastSet, muscleLabel, repLabel, resolve, toKg, useStore, type Active, type Chrono } from '../store'
import { effortLabel, NumInput, setText } from '../sets'
import { fmtDay, fmtDuration, Sheet, Tap } from '../ui'

/**
 * One exercise, the whole screen, swipe for the next. Everything else — the workout's clock,
 * the other exercises, the tab bar — gets out of the way until you leave.
 */
export default function Zen({
  active,
  now,
  chrono,
  setChrono,
  onExit,
  onAdd,
}: {
  active: Active
  now: number
  chrono: Chrono
  setChrono: (c: Chrono) => void
  onExit: () => void
  onAdd: () => void
}) {
  const { profile } = useStore()
  const navigate = useNavigate()
  const scroller = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const [sheet, setSheet] = useState<null | 'menu' | 'history' | 'about'>(null)

  const i = Math.min(at, active.exercises.length - 1)
  const e = active.exercises[i]
  const elapsed = Math.round((chrono.base + (chrono.startedAt ? now - chrono.startedAt : 0)) / 1000)

  // the scroll container is the source of truth for which exercise you are on
  const onScroll = () => {
    const el = scroller.current
    if (el) setAt(Math.round(el.scrollLeft / el.clientWidth))
  }
  useEffect(() => {
    setSheet(null)
  }, [i])

  if (!e) return null

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-ink">
      <header className="safe-top flex shrink-0 items-center justify-between px-4 pt-2 pb-1">
        <Tap onClick={onExit} aria-label="Leave zen mode" className="grid size-11 place-items-center rounded-full text-zinc-400">
          <ChevronLeft size={24} />
        </Tap>
        <div className="flex gap-1.5">
          {active.exercises.map((x, n) => (
            <span key={x.name + n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-accent' : 'w-1.5 bg-surface-2'}`} />
          ))}
        </div>
        <Tap onClick={() => setSheet('menu')} aria-label="Exercise options" className="grid size-11 place-items-center rounded-full text-zinc-400">
          <EllipsisVertical size={22} />
        </Tap>
      </header>

      <div ref={scroller} onScroll={onScroll} className="flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {active.exercises.map((x, ei) => (
          <ExercisePage key={x.name + ei} ei={ei} exercise={x} unit={profile.unit} effort={profile.effort} />
        ))}
      </div>

      {/* chronometer: yours to start, counts up, never nags */}
      <div className="safe-bottom flex shrink-0 items-center justify-center gap-6 px-6 pt-2 pb-4">
        <p className="font-display text-5xl font-bold tabular-nums">{fmtDuration(elapsed)}</p>
        <Tap
          onClick={() => setChrono(chrono.startedAt ? { base: chrono.base + (Date.now() - chrono.startedAt), startedAt: null } : { ...chrono, startedAt: Date.now() })}
          aria-label={chrono.startedAt ? 'Pause timer' : 'Start timer'}
          className="grid size-12 place-items-center rounded-full bg-accent text-ink"
        >
          {chrono.startedAt ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </Tap>
        <Tap onClick={() => setChrono({ base: 0, startedAt: null })} aria-label="Reset timer" className="grid size-12 place-items-center rounded-full bg-surface-2 text-zinc-400">
          <RotateCcw size={20} />
        </Tap>
      </div>

      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet === 'history' ? 'History' : sheet === 'about' ? e.name : e.name}>
        <div className="space-y-2 pb-6">
          {sheet === 'menu' && (
            <>
              <Tap onClick={() => setSheet('history')} className="w-full rounded-2xl bg-surface-2 px-4 py-3.5 text-left font-medium text-zinc-300">
                History
              </Tap>
              <Tap onClick={() => setSheet('about')} className="w-full rounded-2xl bg-surface-2 px-4 py-3.5 text-left font-medium text-zinc-300">
                About this exercise
              </Tap>
              <Tap onClick={onAdd} className="w-full rounded-2xl bg-surface-2 px-4 py-3.5 text-left font-medium text-zinc-300">
                Add exercise
              </Tap>
            </>
          )}
          {sheet === 'history' && (
            <>
              <History exerciseId={e.exerciseId} unit={profile.unit} />
              <Tap onClick={() => navigate(`/exercise/${e.exerciseId}`)} className="w-full rounded-2xl bg-surface-2 px-4 py-3.5 text-center font-medium text-zinc-300">
                See progress
              </Tap>
            </>
          )}
          {sheet === 'about' && <About exerciseId={e.exerciseId} />}
        </div>
      </Sheet>
    </div>
  )
}

function ExercisePage({ ei, exercise, unit, effort }: { ei: number; exercise: Active['exercises'][number]; unit: 'kg' | 'lb'; effort: 'rir' | 'rpe' | 'none' }) {
  const prev = lastSet(exercise.exerciseId)
  const target = exercise.targets.length ? repLabel(exercise.targets[0]) : null
  const cols = effort === 'none' ? 'grid-cols-[1.5rem_1fr_1fr_2.75rem]' : 'grid-cols-[1.5rem_1fr_1fr_1fr_2.75rem]'

  return (
    <section className="h-full w-full shrink-0 basis-full snap-center overflow-y-auto px-6">
      <div className="flex min-h-full flex-col justify-center py-6">
      <h1 className="text-center font-display text-4xl leading-tight font-bold tracking-tight">{exercise.name}</h1>
      <p className="mt-2 mb-8 text-center text-sm text-muted">
        {exercise.sets.length} sets{target && ` · ${target} reps`}
        {prev && ` · last ${fromKg(prev.weight, unit)} ${unit}`}
      </p>

      <div className={`mb-1 grid ${cols} gap-2 px-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase`}>
        <span />
        <span className="text-center">{unit}</span>
        <span className="text-center">Reps</span>
        {effort !== 'none' && <span className="text-center">{effortLabel(effort)}</span>}
        <span />
      </div>

      <div className="space-y-1.5">
        {exercise.sets.map((s, si) => (
          <div key={si} className={`grid ${cols} items-center gap-2 rounded-xl p-1 ${s.done ? 'bg-accent/10' : ''}`}>
            <span className={`text-center font-display font-semibold ${s.done ? 'text-accent' : 'text-zinc-500'}`}>{si + 1}</span>
            <NumInput
              label={`${exercise.name} set ${si + 1} weight`}
              value={s.weight || undefined}
              hint={prev ? String(fromKg(prev.weight, unit)) : '0'}
              step={unit === 'kg' ? 2.5 : 5}
              onChange={(w) => editSet(ei, si, { weight: toKg(w ?? 0, unit) })}
            />
            <NumInput
              label={`${exercise.name} set ${si + 1} reps`}
              value={s.reps || undefined}
              hint={prev ? String(prev.reps) : '0'}
              step={1}
              onChange={(reps) => editSet(ei, si, { reps: reps ?? 0 })}
            />
            {effort !== 'none' && (
              <NumInput
                label={`${exercise.name} set ${si + 1} ${effortLabel(effort)}`}
                value={effort === 'rir' ? s.rir : s.rpe}
                hint="–"
                max={10}
                step={effort === 'rpe' ? 0.5 : 1}
                onChange={(v) => editSet(ei, si, effort === 'rir' ? { rir: v } : { rpe: v })}
              />
            )}
            <Tap
              onClick={() => editSet(ei, si, { done: !s.done })}
              aria-label={s.done ? 'Mark set not done' : 'Complete set'}
              aria-pressed={s.done}
              className={`grid h-11 place-items-center rounded-xl ${s.done ? 'bg-accent text-ink' : 'bg-surface-2 text-zinc-500'}`}
            >
              <motion.span key={String(s.done)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}>
                <Check size={20} strokeWidth={3} />
              </motion.span>
            </Tap>
          </div>
        ))}
      </div>

      <Tap onClick={() => addSet(ei)} className="mx-auto mt-4 flex items-center gap-1.5 rounded-full bg-surface-2 px-5 py-2.5 text-sm font-medium text-zinc-300">
        <Plus size={16} /> Add set
      </Tap>
      </div>
    </section>
  )
}

function History({ exerciseId, unit }: { exerciseId: string; unit: 'kg' | 'lb' }) {
  const past = exerciseHistory(exerciseId)
  if (!past.length) return <p className="py-4 text-sm text-muted">Nothing logged yet.</p>
  return (
    <div className="space-y-2">
      {past.map((s) => (
        <div key={s.id} className="rounded-2xl bg-surface-2 px-4 py-3">
          <p className="text-xs text-zinc-500">{fmtDay(s.at)}</p>
          <p className="mt-1 font-display tabular-nums">{s.sets.map((x) => setText(fromKg(x.weight, unit), x)).join('   ')}</p>
        </div>
      ))}
    </div>
  )
}

function About({ exerciseId }: { exerciseId: string }) {
  const x = resolve(exerciseId)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-accent/10 px-3 py-1.5 text-sm text-accent">{muscleLabel([x.base.muscle])}</span>
        {x.base.secondary.map((m) => (
          <span key={m} className="rounded-full bg-surface-2 px-3 py-1.5 text-sm text-zinc-400">
            {muscleLabel([m])}
          </span>
        ))}
        {x.modifiers.map((m) => (
          <span key={m.id} className="rounded-full bg-surface-2 px-3 py-1.5 text-sm text-zinc-400">
            {m.label}
          </span>
        ))}
      </div>
      <p className="text-sm text-zinc-300">{x.base.description || 'No notes'}</p>
    </div>
  )
}
