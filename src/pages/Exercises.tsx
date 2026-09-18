import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { deleteExercise, MUSCLE_IDS, MUSCLES, muscleLabel, newId, saveExercise, useStore, type Exercise, type MuscleId } from '../store'
import { Block, btn, Page, Sheet, spring, Tap } from '../ui'

type Draft = Omit<Exercise, 'custom'> & { isNew: boolean }

const blank = (): Draft => ({ id: newId(), name: '', muscle: 'chest', secondary: [], description: null, isNew: true })
const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm transition-colors ${on ? 'border-volt bg-volt/10 text-volt' : 'border-line text-zinc-400'}`
const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-volt'

export default function Exercises() {
  const { exercises } = useStore()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleId | null>(null)
  const [open, setOpen] = useState<Exercise | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const q = query.trim().toLowerCase()
  const shown = exercises.filter(
    (e) => (!muscle || e.muscle === muscle || e.secondary.includes(muscle)) && (!q || e.name.toLowerCase().includes(q) || MUSCLES[e.muscle].toLowerCase().includes(q)),
  )

  const edit = (e: Exercise) => {
    setOpen(null)
    setDraft({ ...e, isNew: false })
  }

  return (
    <Page
      subtitle={`${exercises.length} exercises · ${exercises.filter((e) => e.custom).length} custom`}
      title="Exercises"
      action={
        <Tap onClick={() => setDraft(blank())} aria-label="New exercise" className="grid size-12 place-items-center rounded-full bg-volt text-ink">
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
          <div className="card p-6 text-center text-sm text-zinc-500">Nothing matches. Add it with +.</div>
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {MUSCLES[e.muscle]}
                      {e.secondary.length > 0 && <span className="text-zinc-600"> · {muscleLabel(e.secondary)}</span>}
                    </p>
                  </div>
                  {e.custom && <span className="shrink-0 rounded-full bg-volt/10 px-2.5 py-1 text-xs font-medium text-volt">yours</span>}
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
              <span className={chip(true)}>{MUSCLES[open.muscle]}</span>
              {open.secondary.map((m) => (
                <span key={m} className={chip(false)}>
                  {MUSCLES[m]}
                </span>
              ))}
            </div>
            <p className="text-sm text-zinc-400">{open.description || (open.custom ? 'No description.' : 'Built in. Add your own version with + if you want to change it.')}</p>
            {open.custom && (
              <Tap onClick={() => edit(open)} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
                <Pencil size={16} /> Edit
              </Tap>
            )}
          </div>
        )}
      </Sheet>

      {/* create / edit */}
      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.isNew ? 'New exercise' : 'Edit exercise'}>
        {draft && <Editor draft={draft} setDraft={setDraft} />}
      </Sheet>
    </Page>
  )
}

function Editor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft | null) => void }) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const toggleSecondary = (m: MuscleId) =>
    set({ secondary: draft.secondary.includes(m) ? draft.secondary.filter((x) => x !== m) : [...draft.secondary, m] })

  return (
    <div className="space-y-4 pb-4">
      <input className={field} placeholder="Name" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus={draft.isNew} />

      <p className="pt-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Main muscle</p>
      <div className="flex flex-wrap gap-2">
        {MUSCLE_IDS.map((m) => (
          <Tap key={m} onClick={() => set({ muscle: m, secondary: draft.secondary.filter((x) => x !== m) })} className={chip(draft.muscle === m)}>
            {draft.muscle === m && <Check size={14} className="mr-1 inline" />}
            {MUSCLES[m]}
          </Tap>
        ))}
      </div>
      <p className="px-1 text-xs text-zinc-600">This is what muscle summaries count, here and in your schedule.</p>

      <p className="pt-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Also works (optional)</p>
      <div className="flex flex-wrap gap-2">
        {MUSCLE_IDS.filter((m) => m !== draft.muscle).map((m) => (
          <Tap key={m} onClick={() => toggleSecondary(m)} className={chip(draft.secondary.includes(m))}>
            {MUSCLES[m]}
          </Tap>
        ))}
      </div>

      <textarea
        className={`${field} min-h-24 resize-none`}
        placeholder="Description (optional): cues, setup, machine number…"
        value={draft.description ?? ''}
        onChange={(e) => set({ description: e.target.value })}
      />

      <div className="sticky bottom-0 -mx-5 flex gap-3 bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-6 pb-2">
        {!draft.isNew && (
          <Tap
            onClick={() => {
              if (!confirm(`Delete ${draft.name}? Past workouts keep it.`)) return
              deleteExercise(draft.id)
              setDraft(null)
            }}
            aria-label="Delete exercise"
            className={`${btn.ghost} text-red-400`}
          >
            <Trash2 size={20} />
          </Tap>
        )}
        <Tap
          disabled={!draft.name.trim()}
          onClick={() => {
            saveExercise({ id: draft.id, name: draft.name, muscle: draft.muscle, secondary: draft.secondary, description: draft.description })
            setDraft(null)
          }}
          transition={spring}
          className={`${btn.primary} flex-1 disabled:opacity-40 disabled:shadow-none`}
        >
          {draft.isNew ? 'Add exercise' : 'Save'}
        </Tap>
      </div>
    </div>
  )
}
