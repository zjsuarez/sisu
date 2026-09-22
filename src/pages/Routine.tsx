import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, ChevronLeft, Copy, Plus, Trash2, X } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { deleteRoutine, MUSCLES, newId, resolve, saveRoutine, useStore, type RepTarget, type Routine, type RoutineExercise } from '../store'
import { ExercisePicker } from '../exercisePicker'
import { routineTime } from '../progress'
import { btn, fmtDuration, spring, Tap } from '../ui'
import { ask } from '../dialog'

const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-accent'
const num = 'w-14 rounded-lg bg-ink py-1.5 text-center font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-accent'

const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

export default function RoutineEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { routines, plans, profile, sessions } = useStore()

  const existing = routines.find((r) => r.id === id)
  const time = existing ? routineTime(sessions, existing.id) : null
  const [draft, setDraft] = useState<Routine>(
    existing ?? { id: newId(), name: '', planId: params.get('plan') ?? profile.activePlanId, muscles: [], exercises: [] },
  )
  const [picking, setPicking] = useState(false)

  const set = (patch: Partial<Routine>) => setDraft({ ...draft, ...patch })
  const setExercise = (i: number, patch: Partial<RoutineExercise>) => set({ exercises: draft.exercises.map((e, j) => (i === j ? { ...e, ...patch } : e)) })
  const setTarget = (ei: number, si: number, patch: Partial<RepTarget>) =>
    setExercise(ei, { sets: draft.exercises[ei].sets.map((t, j) => (j === si ? { ...t, ...patch } : t)) })

  const addSet = (ei: number) => {
    const sets = draft.exercises[ei].sets
    setExercise(ei, { sets: [...sets, sets.at(-1) ?? { repsMin: 10, repsMax: 10 }] })
  }
  const applyToAll = (ei: number) => {
    const first = draft.exercises[ei].sets[0]
    setExercise(ei, { sets: draft.exercises[ei].sets.map(() => first) })
  }

  const addPicks = (picks: { exerciseId: string; name: string }[]) =>
    set({
      exercises: [
        ...draft.exercises,
        ...picks.map((p) => ({ exerciseId: p.exerciseId, name: p.name, sets: [{ repsMin: 8, repsMax: 10 }, { repsMin: 8, repsMax: 10 }, { repsMin: 8, repsMax: 10 }] })),
      ],
    })

  const save = () => {
    saveRoutine({ ...draft, name: draft.name.trim() })
    navigate(-1)
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="safe-top mx-auto min-h-full max-w-2xl px-5 pb-40"
    >
      <header className="flex items-center gap-3 pt-4 pb-6">
        <Tap onClick={() => navigate(-1)} aria-label="Back" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-zinc-400">
          <ChevronLeft size={20} />
        </Tap>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold">{existing ? 'Edit routine' : 'New routine'}</h1>
          {time && (
            <p className="text-xs text-muted">
              {fmtDuration(time.seconds)} on average · {time.workouts} workout{time.workouts > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </header>

      <div className="space-y-4">
        <input className={field} placeholder="Name" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!existing} />

        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">Plan</p>
          <div className="flex flex-wrap gap-2">
            {[{ id: null, name: 'No plan' }, ...plans].map((p) => (
              <Tap
                key={p.id ?? 'none'}
                onClick={() => set({ planId: p.id })}
                className={`rounded-full border px-3.5 py-2 text-sm ${draft.planId === p.id ? 'border-accent bg-accent/10 text-accent' : 'border-line text-zinc-400'}`}
              >
                {p.name}
              </Tap>
            ))}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {draft.exercises.map((e, ei) => (
            <motion.section key={`${e.exerciseId}-${ei}`} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring} className="card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold">{e.name}</p>
                  <p className="text-xs text-muted">{MUSCLES[resolve(e.exerciseId).base.muscle]}</p>
                </div>
                <Tap onClick={() => set({ exercises: move(draft.exercises, ei, ei - 1) })} aria-label="Move up" className="grid size-8 place-items-center rounded-full bg-surface-2 text-zinc-400">
                  <ArrowUp size={14} />
                </Tap>
                <Tap onClick={() => set({ exercises: move(draft.exercises, ei, ei + 1) })} aria-label="Move down" className="grid size-8 place-items-center rounded-full bg-surface-2 text-zinc-400">
                  <ArrowDown size={14} />
                </Tap>
                <Tap onClick={() => set({ exercises: draft.exercises.filter((_, j) => j !== ei) })} aria-label={`Remove ${e.name}`} className="grid size-8 place-items-center rounded-full bg-surface-2 text-red-400">
                  <X size={14} />
                </Tap>
              </div>

              <div className="mt-3 space-y-1.5">
                {e.sets.map((t, si) => (
                  <div key={si} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                    <span className="w-10 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Set {si + 1}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      aria-label={`Set ${si + 1} minimum reps`}
                      className={num}
                      value={t.repsMin || ''}
                      onFocus={(ev) => ev.target.select()}
                      onChange={(ev) => {
                        const v = Math.max(1, Number(ev.target.value) || 1)
                        setTarget(ei, si, { repsMin: v, repsMax: Math.max(v, t.repsMax) })
                      }}
                    />
                    <span className="text-zinc-600">–</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      aria-label={`Set ${si + 1} maximum reps`}
                      className={num}
                      value={t.repsMax || ''}
                      onFocus={(ev) => ev.target.select()}
                      onChange={(ev) => {
                        const v = Math.max(1, Number(ev.target.value) || 1)
                        setTarget(ei, si, { repsMax: v, repsMin: Math.min(v, t.repsMin) })
                      }}
                    />
                    <span className="flex-1 text-sm text-zinc-500">reps</span>
                    {e.sets.length > 1 && (
                      <Tap onClick={() => setExercise(ei, { sets: e.sets.filter((_, j) => j !== si) })} aria-label={`Remove set ${si + 1}`} className="text-zinc-600">
                        <X size={14} />
                      </Tap>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-2 flex gap-2">
                <Tap onClick={() => addSet(ei)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-zinc-400">
                  <Plus size={15} /> Add set
                </Tap>
                {e.sets.length > 1 && (
                  <Tap onClick={() => applyToAll(ei)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-500">
                    <Copy size={14} /> Same for all
                  </Tap>
                )}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>

        <Tap onClick={() => setPicking(true)} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
          <Plus size={18} /> Add exercise
        </Tap>

        {draft.exercises.length > 0 && (
          <p className="px-1 text-xs text-muted">
            {draft.exercises.length} exercises · {draft.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
          </p>
        )}
      </div>

      {/* actions */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl bg-gradient-to-t from-ink via-ink to-transparent px-5 pt-8 pb-3">
        <div className="flex gap-3">
          {existing && (
            <Tap
              onClick={async () => {
                if (!(await ask({ title: `Delete ${existing.name}?`, body: 'Past workouts stay.', confirm: 'Delete', danger: true }))) return
                deleteRoutine(existing.id)
                navigate(-1)
              }}
              aria-label="Delete routine"
              className={`${btn.ghost} text-red-400`}
            >
              <Trash2 size={20} />
            </Tap>
          )}
          <Tap disabled={!draft.name.trim() || !draft.exercises.length} onClick={save} className={`${btn.primary} flex-1 disabled:opacity-40 disabled:shadow-none`}>
            Save routine
          </Tap>
        </div>
      </div>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onAdd={addPicks} />
    </motion.main>
  )
}
