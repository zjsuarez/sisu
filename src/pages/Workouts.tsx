import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronRight, Dumbbell, Pencil, Play, Plus, Star, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { deletePlan, newId, savePlan, seedStarterPlan, setActivePlan, startSession, useStore, type Plan, type Routine } from '../store'
import { Block, btn, Page, Sheet, Tap } from '../ui'

const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-accent'
const blankPlan = (): Plan => ({ id: newId(), name: '', routineIds: [], schedule: null, defaultStart: null, defaultMinutes: null })

export default function Workouts() {
  const { plans, routines, profile, active, importPending } = useStore()
  const navigate = useNavigate()
  const [planDraft, setPlanDraft] = useState<Plan | null>(null)

  const start = (r: Routine) => {
    if (active && !confirm(`Discard your ${active.routine} session in progress?`)) return
    startSession(r)
    navigate('/session')
  }

  const routinesOf = (plan: Plan) => plan.routineIds.map((id) => routines.find((r) => r.id === id)).filter((r): r is Routine => !!r)
  const loose = routines.filter((r) => !r.planId || !plans.some((p) => p.id === r.planId))
  const activePlan = plans.find((p) => p.id === profile.activePlanId)
  const others = plans.filter((p) => p.id !== profile.activePlanId)

  return (
    <Page
      subtitle={plans.length ? `${plans.length} plan${plans.length > 1 ? 's' : ''} · ${routines.length} routines` : undefined}
      title="Workouts"
      action={
        <Tap onClick={() => setPlanDraft(blankPlan())} aria-label="New plan" className="grid size-12 place-items-center rounded-full bg-accent text-ink">
          <Plus size={24} />
        </Tap>
      }
    >
      {plans.length === 0 && loose.length === 0 && (
        <Block className="card p-6 text-center">
          <p className="font-display text-xl font-semibold">No plans</p>
          {importPending ? (
            // starter routines here would end up sitting next to the real ones once they arrive
            <p className="mt-1 text-sm text-muted">Waiting on your routines from Schedule.</p>
          ) : (
            <Tap onClick={seedStarterPlan} className={`${btn.primary} mt-5 w-full`}>
              Push / Pull / Legs
            </Tap>
          )}
        </Block>
      )}

      {activePlan && <PlanCard plan={activePlan} routines={routinesOf(activePlan)} isActive onEdit={() => setPlanDraft(activePlan)} onStart={start} />}

      {others.map((p) => (
        <PlanCard key={p.id} plan={p} routines={routinesOf(p)} isActive={false} onEdit={() => setPlanDraft(p)} onStart={start} />
      ))}

      {loose.length > 0 && (
        <Block>
          <h2 className="mb-3 font-display text-xl font-semibold">Not in a plan</h2>
          <div className="space-y-2">
            {loose.map((r) => (
              <RoutineRow key={r.id} routine={r} onStart={start} />
            ))}
          </div>
        </Block>
      )}

      <Block>
        <Tap onClick={() => navigate('/routine/new')} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
          <Plus size={18} /> New routine
        </Tap>
      </Block>

      <Block>
        <Tap onClick={() => navigate('/exercises')} className="card flex w-full items-center gap-3 p-4 text-left">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
            <Dumbbell size={18} />
          </div>
          <p className="flex-1 font-semibold">Exercises</p>
          <ChevronRight size={18} className="text-zinc-500" />
        </Tap>
      </Block>

      <Sheet open={!!planDraft} onClose={() => setPlanDraft(null)} title={planDraft && plans.some((p) => p.id === planDraft.id) ? 'Edit plan' : 'New plan'}>
        {planDraft && <PlanEditor draft={planDraft} setDraft={setPlanDraft} />}
      </Sheet>
    </Page>
  )
}

function PlanCard({ plan, routines, isActive, onEdit, onStart }: { plan: Plan; routines: Routine[]; isActive: boolean; onEdit: () => void; onStart: (r: Routine) => void }) {
  return (
    <Block className={`card overflow-hidden ${isActive ? 'border-accent/30' : ''}`}>
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isActive && <Star size={14} className="shrink-0 text-accent" fill="currentColor" />}
            <h2 className="truncate font-display text-2xl font-bold">{plan.name}</h2>
          </div>
          <p className="text-sm text-muted">{routines.length ? `${routines.length} routine${routines.length === 1 ? '' : 's'}` : 'No routines'}</p>
        </div>
        <Tap onClick={onEdit} aria-label={`Edit ${plan.name}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-zinc-400">
          <Pencil size={15} />
        </Tap>
      </div>
      <div className="space-y-2 px-5 pb-5">
        {routines.map((r) => (
          <RoutineRow key={r.id} routine={r} onStart={onStart} />
        ))}
      </div>
      {!isActive && (
        <Tap onClick={() => setActivePlan(plan.id)} className="w-full border-t border-line py-3 text-sm font-medium text-muted">
          Make active
        </Tap>
      )}
    </Block>
  )
}

function RoutineRow({ routine, onStart }: { routine: Routine; onStart: (r: Routine) => void }) {
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

function PlanEditor({ draft, setDraft }: { draft: Plan; setDraft: (p: Plan | null) => void }) {
  const { routines, plans, profile } = useStore()
  const isNew = !plans.some((p) => p.id === draft.id)
  const set = (patch: Partial<Plan>) => setDraft({ ...draft, ...patch })
  const toggle = (id: string) => set({ routineIds: draft.routineIds.includes(id) ? draft.routineIds.filter((x) => x !== id) : [...draft.routineIds, id] })

  return (
    <div className="space-y-4 pb-4">
      <input className={field} placeholder="Plan name (Push Pull Legs…)" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus={isNew} />

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
                    {r.planId && r.planId !== draft.id && <span className="ml-2 text-xs text-zinc-500">in another plan</span>}
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
              setDraft(null)
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
            setDraft(null)
          }}
          className={`${btn.primary} flex-1 disabled:opacity-40 disabled:shadow-none`}
        >
          {isNew ? 'Create plan' : 'Save'}
        </Tap>
      </div>
    </div>
  )
}
