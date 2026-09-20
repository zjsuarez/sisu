import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  buildExerciseId,
  MODIFIER_GROUPS,
  MUSCLES,
  newId,
  resolve,
  saveModifier,
  useStore,
  type Exercise,
  type Modifier,
} from './store'
import { blankExercise, ExerciseForm, type ExerciseDraft } from './exerciseForm'
import { btn, Sheet, spring, Tap } from './ui'

export type Picked = { exerciseId: string; name: string }
type Pick = { key: string; base: Exercise; modifierIds: string[] }

const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-accent'
const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm transition-colors ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-zinc-400'}`

/** Pick several exercises at once; each one can carry modifiers. Used by the routine editor and mid-workout. */
export function ExercisePicker({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (picks: Picked[]) => void }) {
  const { exercises, modifiers } = useStore()
  const [query, setQuery] = useState('')
  const [picks, setPicks] = useState<Pick[]>([])
  const [tuning, setTuning] = useState<string | null>(null)
  const [draft, setDraft] = useState<ExerciseDraft | null>(null)

  const q = query.trim().toLowerCase()
  const options = exercises.filter((e) => !q || e.name.toLowerCase().includes(q) || MUSCLES[e.muscle].toLowerCase().includes(q))

  const idOf = (p: Pick) => buildExerciseId(p.base, p.modifierIds.map((m) => modifiers.find((x) => x.id === m)).filter((m): m is Modifier => !!m))
  const nameOf = (p: Pick) => resolve(idOf(p)).name

  const add = (base: Exercise) => {
    setPicks((list) => [...list, { key: newId(), base, modifierIds: [] }])
    setQuery('')
  }

  const commit = () => {
    // the same variant twice in one go would just be a duplicate row
    const seen = new Set<string>()
    const out = picks.flatMap((p) => {
      const id = idOf(p)
      if (seen.has(id)) return []
      seen.add(id)
      return [{ exerciseId: id, name: nameOf(p) }]
    })
    onAdd(out)
    setPicks([])
    setQuery('')
    onClose()
  }

  const close = () => {
    setPicks([])
    setQuery('')
    onClose()
  }

  const tuned = picks.find((p) => p.key === tuning)

  return (
    <>
      <Sheet open={open} onClose={close} title="Add exercises">
        <div className="space-y-3 pb-28">
          <div className="relative">
            <Search size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={`${field} pl-11`} />
          </div>

          {/* what you've picked so far */}
          <AnimatePresence initial={false}>
            {picks.map((p) => (
              <motion.div
                key={p.key}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                className="flex items-center gap-2 rounded-2xl bg-accent/10 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-accent">{nameOf(p)}</p>
                  {p.modifierIds.length > 0 && <p className="truncate text-xs text-muted">{p.base.name} + {p.modifierIds.length} modifier{p.modifierIds.length > 1 ? 's' : ''}</p>}
                </div>
                <Tap onClick={() => setTuning(p.key)} aria-label={`Modifiers for ${p.base.name}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-zinc-300">
                  <SlidersHorizontal size={15} />
                </Tap>
                <Tap onClick={() => setPicks((list) => list.filter((x) => x.key !== p.key))} aria-label={`Remove ${p.base.name}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                  <X size={15} />
                </Tap>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="space-y-1">
            {options.slice(0, 40).map((x) => (
              <Tap key={x.id} onClick={() => add(x)} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left">
                <span>
                  {x.name}
                  <span className="ml-2 text-xs text-muted">{MUSCLES[x.muscle]}</span>
                </span>
                <Plus size={16} className="text-muted" />
              </Tap>
            ))}
            <Tap
              onClick={() => setDraft(blankExercise(query.trim()))}
              className="flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-left"
            >
              <span>{query.trim() ? `New: ${query.trim()}` : 'New exercise'}</span>
              <Plus size={16} className="text-muted" />
            </Tap>
          </div>
        </div>

        {picks.length > 0 && (
          <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-8 pb-3">
            <Tap onClick={commit} className={`${btn.primary} w-full`}>
              Add {picks.length} exercise{picks.length > 1 ? 's' : ''}
            </Tap>
          </div>
        )}
      </Sheet>

      {/* modifiers for one pick */}
      <Sheet open={!!tuned} onClose={() => setTuning(null)} title={tuned ? nameOf(tuned) : ''}>
        {tuned && (
          <ModifierPicker
            selected={tuned.modifierIds}
            onToggle={(id) =>
              setPicks((list) =>
                list.map((p) => (p.key === tuned.key ? { ...p, modifierIds: p.modifierIds.includes(id) ? p.modifierIds.filter((x) => x !== id) : [...p.modifierIds, id] } : p)),
              )
            }
          />
        )}
      </Sheet>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title="New exercise">
        {draft && (
          <ExerciseForm
            draft={draft}
            setDraft={setDraft}
            onSaved={(e) => add({ id: e.id, name: e.name, muscle: e.muscle, secondary: e.secondary, description: e.description, custom: true })}
          />
        )}
      </Sheet>
    </>
  )
}

function ModifierPicker({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const { modifiers } = useStore()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')

  const addOwn = () => {
    const name = label.trim()
    if (!name) return
    const id = newId()
    saveModifier(id, name)
    onToggle(id)
    setLabel('')
    setAdding(false)
  }

  return (
    <div className="space-y-5 pb-4">
      {MODIFIER_GROUPS.map((g) => {
        const list = modifiers.filter((m) => m.group === g.id)
        const own = g.id === 'other' ? modifiers.filter((m) => m.custom) : []
        if (!list.length && !own.length) return null
        return (
          <div key={g.id}>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {[...list, ...own].map((m) => (
                <Tap key={m.id} onClick={() => onToggle(m.id)} className={chip(selected.includes(m.id))}>
                  {selected.includes(m.id) && <Check size={14} className="mr-1 inline" />}
                  {m.label}
                </Tap>
              ))}
              {g.id === 'other' &&
                (adding ? (
                  <div className="flex w-full gap-2">
                    <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Your modifier" autoFocus className={field} onKeyDown={(e) => e.key === 'Enter' && addOwn()} />
                    <Tap onClick={addOwn} className={btn.primary}>
                      Add
                    </Tap>
                  </div>
                ) : (
                  <Tap onClick={() => setAdding(true)} aria-label="New modifier" className="rounded-full bg-ink px-3.5 py-2 text-sm text-muted">
                    <Plus size={14} className="mr-1 inline" />
                    New
                  </Tap>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
