import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Pencil, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { MUSCLE_IDS, MUSCLES, muscleLabel, resolve, useStore, type MuscleId, type ResolvedExercise } from '../store'
import { blankExercise, ExerciseForm, type ExerciseDraft } from '../exerciseForm'
import { Block, btn, Page, Sheet, Tap } from '../ui'
const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm transition-colors ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-zinc-400'}`
const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-accent'

export default function Exercises() {
  const { exercises, routines, sessions } = useStore()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleId | null>(null)
  const [open, setOpen] = useState<ResolvedExercise | null>(null)
  const [draft, setDraft] = useState<ExerciseDraft | null>(null)

  // variants aren't records: the ones worth listing are the ones you actually use
  const used = [
    ...new Set([...routines.flatMap((r) => r.exercises), ...sessions.flatMap((s) => s.exercises)].map((e) => e.exerciseId).filter((id) => id.includes('~'))),
  ]
  const all = [...exercises.map((e) => resolve(e.id)), ...used.map(resolve)].sort((a, b) => a.name.localeCompare(b.name))

  const q = query.trim().toLowerCase()
  const shown = all.filter(
    (e) => (!muscle || e.base.muscle === muscle || e.base.secondary.includes(muscle)) && (!q || e.name.toLowerCase().includes(q) || MUSCLES[e.base.muscle].toLowerCase().includes(q)),
  )

  const edit = (e: ResolvedExercise) => {
    setOpen(null)
    setDraft({ ...e, isNew: false })
  }

  return (
    <Page
      subtitle={`${all.length} · ${used.length} with modifiers`}
      title="Exercises"
      action={
        <Tap onClick={() => setDraft(blankExercise())} aria-label="New exercise" className="grid size-12 place-items-center rounded-full bg-accent text-ink">
          <Plus size={24} />
        </Tap>
      }
    >
      <Block className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={`${field} pl-11`} />
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <Tap onClick={() => setMuscle(null)} className={`${chip(!muscle)} shrink-0`}>
            All
          </Tap>
          {MUSCLE_IDS.map((m) => (
            <Tap key={m} onClick={() => setMuscle(muscle === m ? null : m)} className={`${chip(muscle === m)} shrink-0`}>
              {MUSCLES[m]}
            </Tap>
          ))}
        </div>
      </Block>

      <Block>
        {shown.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No matches</div>
        ) : (
          <div className="card divide-y divide-line">
            <AnimatePresence initial={false}>
              {shown.map((e) => (
                <motion.button
                  key={e.id}
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setOpen(e)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
                >
                  {e.modifiers.length > 0 && <SlidersHorizontal size={16} className="shrink-0 text-muted" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.name}</p>
                    {e.modifiers.length > 0 ? (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">{e.base.name}</span>
                        {e.modifiers.map((m) => (
                          <span key={m.id} className="rounded-full bg-surface-2 px-2 py-0.5 text-zinc-400">
                            {m.label}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="truncate text-xs text-muted">
                        {MUSCLES[e.base.muscle]}
                        {e.base.secondary.length > 0 && <span className="text-zinc-600"> · {muscleLabel(e.base.secondary)}</span>}
                      </p>
                    )}
                  </div>
                  {e.custom && e.modifiers.length === 0 && <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">yours</span>}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Block>

      {/* detail */}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <div className="space-y-4 pb-4">
            <div className="flex flex-wrap gap-2">
              <span className={chip(true)}>{MUSCLES[open.base.muscle]}</span>
              {open.base.secondary.map((m) => (
                <span key={m} className={chip(false)}>
                  {MUSCLES[m]}
                </span>
              ))}
            </div>
            {open.modifiers.length > 0 && (
              <p className="flex flex-wrap items-center gap-1 text-sm">
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-accent">{open.base.name}</span>
                {open.modifiers.map((m) => (
                  <span key={m.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-zinc-400">
                    {m.label}
                  </span>
                ))}
              </p>
            )}
            {open.description && <p className="text-sm text-zinc-400">{open.description}</p>}
            {open.custom && open.modifiers.length === 0 && (
              <Tap onClick={() => edit(open)} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
                <Pencil size={16} /> Edit
              </Tap>
            )}
          </div>
        )}
      </Sheet>

      {/* create / edit */}
      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.isNew ? 'New exercise' : 'Edit exercise'}>
        {draft && <ExerciseForm draft={draft} setDraft={setDraft} />}
      </Sheet>
    </Page>
  )
}
