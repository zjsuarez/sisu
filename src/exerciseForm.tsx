import { Check, Trash2 } from 'lucide-react'
import { deleteExercise, MUSCLE_IDS, MUSCLES, newId, saveExercise, type Exercise, type MuscleId } from './store'
import { btn, Tap } from './ui'
import { ask } from './dialog'

export type ExerciseDraft = Omit<Exercise, 'custom'> & { isNew: boolean }

export const blankExercise = (name = ''): ExerciseDraft => ({ id: newId(), name, muscle: 'chest', secondary: [], description: null, isNew: true })

const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm transition-colors ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-zinc-400'}`
const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-accent'

/** Used in the library, and wherever you pick an exercise and it isn't there yet. */
export function ExerciseForm({ draft, setDraft, onSaved }: { draft: ExerciseDraft; setDraft: (d: ExerciseDraft | null) => void; onSaved?: (e: ExerciseDraft) => void }) {
  const set = (patch: Partial<ExerciseDraft>) => setDraft({ ...draft, ...patch })
  const toggleSecondary = (m: MuscleId) => set({ secondary: draft.secondary.includes(m) ? draft.secondary.filter((x) => x !== m) : [...draft.secondary, m] })

  return (
    <div className="space-y-4 pb-4">
      <input className={field} placeholder="Name" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus={draft.isNew && !draft.name} />

      <p className="pt-2 text-xs font-semibold tracking-widest text-muted uppercase">Muscle</p>
      <div className="flex flex-wrap gap-2">
        {MUSCLE_IDS.map((m) => (
          <Tap key={m} onClick={() => set({ muscle: m, secondary: draft.secondary.filter((x) => x !== m) })} className={chip(draft.muscle === m)}>
            {draft.muscle === m && <Check size={14} className="mr-1 inline" />}
            {MUSCLES[m]}
          </Tap>
        ))}
      </div>

      <p className="pt-2 text-xs font-semibold tracking-widest text-muted uppercase">Also works</p>
      <div className="flex flex-wrap gap-2">
        {MUSCLE_IDS.filter((m) => m !== draft.muscle).map((m) => (
          <Tap key={m} onClick={() => toggleSecondary(m)} className={chip(draft.secondary.includes(m))}>
            {MUSCLES[m]}
          </Tap>
        ))}
      </div>

      <textarea className={`${field} min-h-24 resize-none`} placeholder="Notes" value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} />

      <div className="sticky bottom-0 -mx-5 flex gap-3 bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-6 pb-2">
        {!draft.isNew && (
          <Tap
            onClick={async () => {
              if (!(await ask({ title: `Delete ${draft.name}?`, body: 'Past workouts keep it.', confirm: 'Delete', danger: true }))) return
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
            const saved = { ...draft, name: draft.name.trim() }
            saveExercise({ id: saved.id, name: saved.name, muscle: saved.muscle, secondary: saved.secondary, description: saved.description })
            setDraft(null)
            onSaved?.(saved)
          }}
          className={`${btn.primary} flex-1 disabled:opacity-40`}
        >
          {draft.isNew ? 'Add exercise' : 'Save'}
        </Tap>
      </div>
    </div>
  )
}
