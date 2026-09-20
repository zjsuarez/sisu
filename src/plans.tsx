import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Play, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { deletePlan, savePlan, setActivePlan, useStore, type Plan, type Routine, type Session } from './store'
import { btn, Tap } from './ui'

const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-accent'

/** Everything a plan card shows, worked out from what's already stored. */
export function planStats(plan: Plan, routines: Routine[], sessions: Session[]) {
  const mine = sessions.filter((s) => s.planId === plan.id)
  return {
    routines: plan.routineIds.filter((id) => routines.some((r) => r.id === id)).length,
    workouts: mine.length,
    // "started" is the first workout you actually logged under it, not the day it was created
    startedAt: mine.length ? Math.min(...mine.map((s) => s.at)) : null,
    createdAt: plan.createdAt,
  }
}

export function RoutineRow({ routine, onStart }: { routine: Routine; onStart: (r: Routine) => void }) {
  const navigate = useNavigate()
  const sets = routine.exercises.reduce((n, e) => n + e.sets.length, 0)
  const ready = routine.exercises.length > 0

  return (
    <div className="flex items-stretch gap-2">
      <motion.button whileTap={{ scale: 0.99 }} onClick={() => navigate(`/routine/${routine.id}`)} className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 py-3 text-left">
        <p className="truncate font-semibold">{routine.name}</p>
        <p className="truncate text-xs text-muted">{ready ? `${routine.exercises.length} exercises · ${sets} sets` : 'No exercises'}</p>
      </motion.button>
      <Tap
        onClick={() => onStart(routine)}
        disabled={!ready}
        aria-label={`Start ${routine.name}`}
        className="grid w-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-white disabled:text-zinc-700"
      >
        <Play size={18} fill="currentColor" />
      </Tap>
    </div>
  )
}

/** Name and which routines belong to it. Used when creating one and from inside a plan. */
export function PlanEditor({ plan, onClose, onDeleted }: { plan: Plan; onClose: () => void; onDeleted?: () => void }) {
  const { routines, plans, profile } = useStore()
  const isNew = !plans.some((p) => p.id === plan.id)
  const [draft, setDraft] = useState<Plan>(plan)
  const set = (patch: Partial<Plan>) => setDraft({ ...draft, ...patch })
  const toggle = (id: string) => set({ routineIds: draft.routineIds.includes(id) ? draft.routineIds.filter((x) => x !== id) : [...draft.routineIds, id] })

  return (
    <div className="space-y-4 pb-4">
      <input className={field} placeholder="Plan name" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus={isNew} />

      <p className="pt-2 text-xs font-semibold tracking-widest text-muted uppercase">Routines</p>
      {routines.length === 0 ? (
        <p className="text-sm text-muted">No routines yet.</p>
      ) : (
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {routines.map((r) => {
              const on = draft.routineIds.includes(r.id)
              return (
                <motion.button
                  key={r.id}
                  layout
                  whileTap={{ scale: 0.99 }}
                  onClick={() => toggle(r.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${on ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-zinc-300'}`}
                >
                  <span className="truncate">
                    {r.name}
                    {r.planId && r.planId !== draft.id && <span className="ml-2 text-xs text-muted">in another plan</span>}
                  </span>
                  {on && <Check size={16} />}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 flex gap-3 bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-6 pb-2">
        {!isNew && (
          <Tap
            onClick={() => {
              if (!confirm(`Delete ${draft.name}? Its routines stay.`)) return
              deletePlan(draft.id)
              onClose()
              onDeleted?.()
            }}
            aria-label="Delete plan"
            className={`${btn.ghost} text-red-400`}
          >
            <Trash2 size={20} />
          </Tap>
        )}
        <Tap
          disabled={!draft.name.trim()}
          onClick={() => {
            savePlan({ ...draft, name: draft.name.trim() })
            if (isNew && !profile.activePlanId) setActivePlan(draft.id)
            onClose()
          }}
          className={`${btn.primary} flex-1 disabled:opacity-40`}
        >
          {isNew ? 'Create plan' : 'Save'}
        </Tap>
      </div>
    </div>
  )
}
