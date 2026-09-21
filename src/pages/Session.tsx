import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Plus, Timer, Trash2 } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { addExercise, addSet, discardSession, editSet, finishSession, fromKg, lastSet, repLabel, toKg, useStore, volume } from '../store'
import { ExercisePicker } from '../exercisePicker'
import { btn, fmtCompact, fmtDuration, spring, Tap, useNow } from '../ui'
import { ask, askText } from '../dialog'

const REST_SEC = 90

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
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)

  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0
  useEffect(() => {
    if (!restUntil) return
    const t = setTimeout(() => {
      navigator.vibrate?.([200, 100, 200])
      setRestUntil(null)
    }, restUntil - Date.now())
    return () => clearTimeout(t)
  }, [restUntil])

  if (!active) return <Navigate to="/workouts" replace />

  const total = active.exercises.reduce((n, e) => n + e.sets.length, 0)
  const done = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

  const toggle = (ei: number, si: number, wasDone: boolean) => {
    editSet(ei, si, { done: !wasDone })
    setRestUntil(wasDone ? null : Date.now() + REST_SEC * 1000)
  }

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
          <Tap onClick={finish} className="rounded-full bg-accent px-4 py-2 font-display text-sm font-semibold text-ink">
            Finish
          </Tap>
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
            <h2 className="font-display text-lg font-semibold">{e.name}</h2>
            <p className="mb-3 text-xs text-zinc-500">{targetLabel(e.targets)}</p>
            <div className="mb-1 grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 px-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              <span>Set</span>
              <span className="text-center">{profile.unit}</span>
              <span className="text-center">Reps</span>
              <span />
            </div>
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {e.sets.map((s, si) => (
                  <motion.div
                    key={si}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto', backgroundColor: s.done ? 'rgba(215,255,62,0.10)' : 'rgba(0,0,0,0)' }}
                    className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-xl p-1"
                  >
                    <span className={`text-center font-display font-semibold ${s.done ? 'text-accent' : 'text-zinc-500'}`}>{si + 1}</span>
                    <NumInput
                      label={`${e.name} set ${si + 1} weight`}
                      value={fromKg(s.weight, profile.unit)}
                      hint={prev ? String(fromKg(prev.weight, profile.unit)) : '0'}
                      step={profile.unit === 'kg' ? 2.5 : 5}
                      onChange={(w) => editSet(ei, si, { weight: toKg(w, profile.unit) })}
                    />
                    <NumInput label={`${e.name} set ${si + 1} reps`} value={s.reps} hint={prev ? String(prev.reps) : '0'} step={1} onChange={(reps) => editSet(ei, si, { reps })} />
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

      {/* rest timer */}
      <AnimatePresence>
        {restUntil && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={spring}
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4"
          >
            <div className="mb-2 overflow-hidden rounded-3xl border border-line bg-surface/90 shadow-2xl shadow-black backdrop-blur-xl">
              <div className="flex items-center gap-4 p-4">
                <Timer className="text-accent" />
                <div className="flex-1">
                  <p className="text-xs text-zinc-500">Rest</p>
                  <p className="font-display text-3xl font-bold tabular-nums">{fmtDuration(restLeft)}</p>
                </div>
                <Tap onClick={() => setRestUntil((t) => (t ?? Date.now()) + 15_000)} className="rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium">
                  +15s
                </Tap>
                <Tap onClick={() => setRestUntil(null)} className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-ink">
                  Skip
                </Tap>
              </div>
              <motion.div className="h-1 bg-accent" animate={{ width: `${(restLeft / REST_SEC) * 100}%` }} transition={{ ease: 'linear', duration: 1 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onAdd={(picks) => picks.forEach((p) => addExercise(p.exerciseId, p.name))} />
    </motion.main>
  )
}

function NumInput({ value, onChange, step, label, hint = '0' }: { value: number; onChange: (n: number) => void; step: number; label: string; hint?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={0}
      step={step}
      value={value || ''}
      placeholder={hint}
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="h-11 w-full rounded-xl bg-surface-2 text-center font-display text-lg font-semibold tabular-nums outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-accent"
    />
  )
}
