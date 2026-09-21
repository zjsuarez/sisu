import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Expand, Plus, Trash2 } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { addExercise, addSet, discardSession, editSet, finishSession, fromKg, lastSet, moveExercise, repLabel, toKg, useStore, volume } from '../store'
import { ExercisePicker } from '../exercisePicker'
import { btn, fmtCompact, fmtDuration, spring, Tap, useNow } from '../ui'
import { ask, askText } from '../dialog'
import { NO_CHRONO } from '../store'
import { Chronometer } from '../chrono'
import { effortLabel, NumInput } from '../sets'
import Zen from './Zen'

const ZEN_KEY = 'sisu.zen'

const nowHm = () => new Date().toTimeString().slice(0, 5)

/** what the routine asked for: "3 × 8-10", or each set when they differ */
const targetLabel = (targets: { repsMin: number; repsMax: number }[]) => {
  if (!targets.length) return 'added on the fly'
  const first = repLabel(targets[0])
  return targets.every((t) => repLabel(t) === first) ? `${targets.length} × ${first} reps` : targets.map(repLabel).join(' · ') + ' reps'
}

export default function Session() {
  const { active: live, profile } = useStore()
  // keep rendering the last session while the exit animation runs after finish/discard
  const [last, setLast] = useState(live)
  if (live && live !== last) setLast(live)
  const active = live ?? last
  const navigate = useNavigate()
  const now = useNow()
  const [picking, setPicking] = useState(false)
  // zen mode sticks: if you train that way, every workout opens that way
  const [zen, setZen] = useState(() => localStorage.getItem(ZEN_KEY) === '1')
  const [at, setAt] = useState(0) // which exercise zen is showing
  const showZen = (on: boolean) => {
    setZen(on)
    localStorage.setItem(ZEN_KEY, on ? '1' : '0')
  }
  const openZen = () => {
    // stay where you were if there is still work there, otherwise jump to the first unfinished one
    const here = active?.exercises[at]
    if (!here?.sets.some((s) => !s.done)) {
      const next = active?.exercises.findIndex((e) => e.sets.some((s) => !s.done)) ?? -1
      setAt(next < 0 ? 0 : next)
    }
    showZen(true)
  }

  if (!active) return <Navigate to="/workouts" replace />

  const total = active.exercises.reduce((n, e) => n + e.sets.length, 0)
  const done = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

  const cols = profile.effort === 'none' ? 'grid-cols-[2rem_1fr_1fr_3rem]' : 'grid-cols-[1.5rem_1fr_1fr_1fr_2.75rem]'

  const toggle = (ei: number, si: number, wasDone: boolean) => editSet(ei, si, { done: !wasDone })

  const finish = async () => {
    if (!done && !(await ask({ title: 'No sets ticked', body: 'End this workout without saving it?', confirm: 'End', danger: true }))) return
    // unticked sets are dropped, so say so before it happens rather than after
    const left = total - done
    if (done && left && !(await ask({ title: `${left} set${left > 1 ? 's' : ''} not ticked`, body: `${left > 1 ? 'They' : 'It'} won't be saved.`, confirm: 'Finish' }))) return
    const hours = (Date.now() - active.startedAt) / 3_600_000
    // forgetting to tap Finish would otherwise log a 10-hour workout, and put a 10-hour block in the calendar
    let end
    if (hours > 3) {
      const answer = await askText({ title: 'Still running', body: 'This workout has been open for hours. What time did you finish?', value: nowHm(), type: 'time' })
      if (answer === null) return
      end = /^\d{1,2}:\d{2}$/.test(answer) ? answer.padStart(5, '0') : undefined
    }
    finishSession(end)
    navigate('/')
  }

  const discard = async () => {
    if (!(await ask({ title: 'Discard workout?', body: 'Nothing about it is saved.', confirm: 'Discard', danger: true }))) return
    discardSession()
    navigate('/workouts')
  }

  if (zen && active.exercises.length)
    return <Zen active={active} now={now} at={at} setAt={setAt} onExit={() => showZen(false)} onAdd={() => setPicking(true)} />

  return (
    <motion.main initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={spring} className="mx-auto min-h-full max-w-md pb-40">
      {/* sticky header */}
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-ink/80 px-5 pb-4 backdrop-blur-xl">
        <div className="flex items-center justify-between pt-2">
          <Tap onClick={() => navigate('/')} aria-label="Minimize workout" className="grid size-10 place-items-center rounded-full bg-surface-2 text-zinc-400">
            <ChevronDown size={20} />
          </Tap>
          <div className="text-center">
            <p className="font-display text-lg font-bold">{active.routine}</p>
            <p className="font-mono text-sm text-accent tabular-nums">{fmtDuration(Math.round((now - active.startedAt) / 1000))}</p>
          </div>
          <div className="flex items-center gap-2">
            <Tap onClick={openZen} aria-label="Zen mode" className="grid size-10 place-items-center rounded-full bg-surface-2 text-zinc-400">
              <Expand size={17} />
            </Tap>
            <Tap onClick={finish} className="rounded-full bg-accent px-4 py-2 font-display text-sm font-semibold text-ink">
              Finish
            </Tap>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${total ? (done / total) * 100 : 0}%` }} transition={spring} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-zinc-500">
          <span>
            {done}/{total} sets
          </span>
          <span>
            {fmtCompact(fromKg(volume(active.exercises), profile.unit))} {profile.unit} lifted
          </span>
        </div>
      </header>

      <div className="space-y-4 px-5 pt-5">
        {active.exercises.map((e, ei) => {
          const prev = lastSet(e.exerciseId) // last time's numbers, as a hint in the empty boxes
          return (
          <motion.section
            key={e.name + ei}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: ei * 0.05 }}
            className="card p-4"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-lg font-semibold">{e.name}</h2>
                <p className="text-xs text-zinc-500">{targetLabel(e.targets)}</p>
              </div>
              <Tap
                onClick={() => moveExercise(ei, ei - 1)}
                disabled={ei === 0}
                aria-label={`Move ${e.name} up`}
                className="grid size-8 place-items-center rounded-full bg-surface-2 text-zinc-400 disabled:text-zinc-700"
              >
                <ArrowUp size={14} />
              </Tap>
              <Tap
                onClick={() => moveExercise(ei, ei + 1)}
                disabled={ei === active.exercises.length - 1}
                aria-label={`Move ${e.name} down`}
                className="grid size-8 place-items-center rounded-full bg-surface-2 text-zinc-400 disabled:text-zinc-700"
              >
                <ArrowDown size={14} />
              </Tap>
            </div>
            <div className="mb-3" />
            <div className={`mb-1 grid ${cols} gap-2 px-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase`}>
              <span />
              <span className="text-center">{profile.unit}</span>
              <span className="text-center">Reps</span>
              {profile.effort !== 'none' && <span className="text-center">{effortLabel(profile.effort)}</span>}
              <span />
            </div>
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {e.sets.map((s, si) => (
                  <motion.div
                    key={si}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto', backgroundColor: s.done ? 'rgba(250,250,250,0.10)' : 'rgba(0,0,0,0)' }}
                    className={`grid ${cols} items-center gap-2 rounded-xl p-1`}
                  >
                    <span className={`text-center font-display font-semibold ${s.done ? 'text-accent' : 'text-zinc-500'}`}>{si + 1}</span>
                    <NumInput
                      label={`${e.name} set ${si + 1} weight`}
                      value={fromKg(s.weight, profile.unit) || undefined}
                      hint={prev ? String(fromKg(prev.weight, profile.unit)) : '0'}
                      step={profile.unit === 'kg' ? 2.5 : 5}
                      onChange={(w) => editSet(ei, si, { weight: toKg(w ?? 0, profile.unit) })}
                    />
                    <NumInput
                      label={`${e.name} set ${si + 1} reps`}
                      value={s.reps || undefined}
                      hint={prev ? String(prev.reps) : '0'}
                      step={1}
                      onChange={(reps) => editSet(ei, si, { reps: reps ?? 0 })}
                    />
                    {profile.effort !== 'none' && (
                      <NumInput
                        label={`${e.name} set ${si + 1} ${effortLabel(profile.effort)}`}
                        value={profile.effort === 'rir' ? s.rir : s.rpe}
                        hint="–"
                        max={10}
                        step={profile.effort === 'rpe' ? 0.5 : 1}
                        onChange={(v) => editSet(ei, si, profile.effort === 'rir' ? { rir: v } : { rpe: v })}
                      />
                    )}
                    <Tap
                      onClick={() => toggle(ei, si, !!s.done)}
                      aria-label={s.done ? 'Mark set not done' : 'Complete set'}
                      aria-pressed={s.done}
                      className={`grid h-11 place-items-center rounded-xl transition-colors ${s.done ? 'bg-accent text-ink' : 'bg-surface-2 text-zinc-500'}`}
                    >
                      <motion.span key={String(s.done)} initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}>
                        <Check size={20} strokeWidth={3} />
                      </motion.span>
                    </Tap>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <Tap onClick={() => addSet(ei)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium text-zinc-400">
              <Plus size={16} /> Add set
            </Tap>
          </motion.section>
          )
        })}

        <Tap onClick={() => setPicking(true)} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
          <Plus size={18} /> Add exercise
        </Tap>

        <Tap onClick={discard} className="flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-red-400/80">
          <Trash2 size={16} /> Discard workout
        </Tap>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 pb-2">
        <div className="rounded-3xl bg-surface/90 px-5 py-3 backdrop-blur-xl">
          <Chronometer chrono={active.chrono ?? NO_CHRONO} now={now} compact />
        </div>
      </div>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onAdd={(picks) => picks.forEach((p) => addExercise(p.exerciseId, p.name))} />
    </motion.main>
  )
}
