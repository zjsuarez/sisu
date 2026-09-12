import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Minus, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { deleteRoutine, LIBRARY, saveRoutine, startSession, uid, useStore, type Routine } from '../store'
import { Block, btn, Page, Sheet, spring, Tap } from '../ui'

const blank = (): Routine => ({ id: uid(), name: '', tag: '', exercises: [] })

export default function Workouts() {
  const { routines, active, profile } = useStore()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Routine | null>(null)

  const start = (r: Routine) => {
    if (active && !confirm(`Discard your ${active.routine} session in progress?`)) return
    startSession(r)
    navigate('/session')
  }

  return (
    <Page
      subtitle={`${routines.length} routines`}
      title="Workouts"
      action={
        <Tap onClick={() => setDraft(blank())} aria-label="New routine" className="grid size-12 place-items-center rounded-full bg-volt text-ink">
          <Plus size={24} />
        </Tap>
      }
    >
      <AnimatePresence initial={false}>
        {routines.map((r) => (
          <Block key={r.id} layout exit={{ opacity: 0, scale: 0.95 }} className="card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold">{r.name}</h2>
                  {r.tag && <p className="text-sm text-zinc-500">{r.tag}</p>}
                </div>
                <Tap onClick={() => setDraft(structuredClone(r))} aria-label={`Edit ${r.name}`} className="grid size-9 place-items-center rounded-full bg-surface-2 text-zinc-400">
                  <Pencil size={15} />
                </Tap>
              </div>
              <ul className="mt-4 space-y-1.5">
                {r.exercises.map((e) => (
                  <li key={e.name} className="flex justify-between text-sm">
                    <span className="text-zinc-300">{e.name}</span>
                    <span className="text-zinc-500 tabular-nums">
                      {e.sets} × {e.reps}
                      {e.weight > 0 && ` · ${e.weight}${profile.unit}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Tap onClick={() => start(r)} disabled={!r.exercises.length} className="flex w-full items-center justify-center gap-2 border-t border-line py-4 font-display font-semibold text-volt disabled:opacity-40">
              <Play size={16} fill="currentColor" /> Start
            </Tap>
          </Block>
        ))}
      </AnimatePresence>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft && routines.some((r) => r.id === draft.id) ? 'Edit routine' : 'New routine'}>
        {draft && <Editor draft={draft} setDraft={setDraft} isNew={!routines.some((r) => r.id === draft.id)} />}
      </Sheet>
    </Page>
  )
}

function Editor({ draft, setDraft, isNew }: { draft: Routine; setDraft: (r: Routine | null) => void; isNew: boolean }) {
  const set = (patch: Partial<Routine>) => setDraft({ ...draft, ...patch })
  const has = (name: string) => draft.exercises.some((e) => e.name === name)
  const toggle = (name: string) =>
    set({ exercises: has(name) ? draft.exercises.filter((e) => e.name !== name) : [...draft.exercises, { name, sets: 3, reps: 10, weight: 0 }] })
  const bump = (name: string, d: number) =>
    set({ exercises: draft.exercises.map((e) => (e.name === name ? { ...e, sets: Math.max(1, Math.min(10, e.sets + d)) } : e)) })

  const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-volt'

  return (
    <div className="space-y-4 pb-4">
      <input className={field} placeholder="Routine name" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus={isNew} />
      <input className={field} placeholder="Focus (e.g. Chest · Triceps)" value={draft.tag} onChange={(e) => set({ tag: e.target.value })} />

      <AnimatePresence initial={false}>
        {draft.exercises.map((e) => (
          <motion.div key={e.name} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-2.5">
              <span className="flex-1 text-sm font-medium">{e.name}</span>
              <Tap onClick={() => bump(e.name, -1)} aria-label="Fewer sets" className="grid size-8 place-items-center rounded-full bg-ink"><Minus size={14} /></Tap>
              <span className="w-12 text-center text-sm tabular-nums">{e.sets} sets</span>
              <Tap onClick={() => bump(e.name, 1)} aria-label="More sets" className="grid size-8 place-items-center rounded-full bg-ink"><Plus size={14} /></Tap>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <p className="pt-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Exercises</p>
      <div className="flex flex-wrap gap-2">
        {LIBRARY.map((name) => (
          <Tap
            key={name}
            onClick={() => toggle(name)}
            className={`flex items-center gap-1 rounded-full border px-3.5 py-2 text-sm transition-colors ${has(name) ? 'border-volt bg-volt/10 text-volt' : 'border-line text-zinc-400'}`}
          >
            {has(name) && <Check size={14} />} {name}
          </Tap>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-5 flex gap-3 bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-6 pb-2">
        {!isNew && (
          <Tap
            onClick={() => {
              if (!confirm(`Delete ${draft.name}?`)) return
              deleteRoutine(draft.id)
              setDraft(null)
            }}
            aria-label="Delete routine"
            className={`${btn.ghost} text-red-400`}
          >
            <Trash2 size={20} />
          </Tap>
        )}
        <Tap
          disabled={!draft.name.trim() || !draft.exercises.length}
          onClick={() => {
            saveRoutine({ ...draft, name: draft.name.trim() })
            setDraft(null)
          }}
          className={`${btn.primary} flex-1 disabled:opacity-40 disabled:shadow-none`}
        >
          Save routine
        </Tap>
      </div>
    </div>
  )
}
