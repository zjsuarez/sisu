import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronRight, Dumbbell, Pencil, Play, Plus, Star, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { deletePlan, muscleLabel, newId, repLabel, savePlan, seedStarterPlan, setActivePlan, startSession, useStore, type Plan, type Routine } from '../store'
import { Block, btn, Page, Sheet, Tap } from '../ui'

const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none placeholder:text-zinc-600 focus:border-volt'
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
      subtitle={plans.length ? `${plans.length} plan${plans.length > 1 ? 's' : ''} · ${routines.length} routines` : 'Plans and routines'}
      title="Workouts"
      action={
        <Tap onClick={() => setPlanDraft(blankPlan())} aria-label="New plan" className="grid size-12 place-items-center rounded-full bg-volt text-ink">
          <Plus size={24} />
        </Tap>
      }
    >
      {plans.length === 0 && loose.length === 0 && (
        <Block className="card p-6 text-center">
          <p className="font-display text-xl font-semibold">No plans yet</p>
          {importPending ? (
            // starter routines here would end up sitting next to the real ones once they arrive
            <p className="mt-1 text-sm text-zinc-500">Your routines from Schedule haven't moved over yet. Open the schedule app once and they'll appear here.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-zinc-500">A plan groups your routines: Push Pull Legs, Upper Lower, whatever you run.</p>
              <Tap onClick={seedStarterPlan} className={`${btn.primary} mt-5 w-full`}>
                Start with Push / Pull / Legs
              </Tap>
            </>
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
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-volt">
            <Dumbbell size={18} />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Exercise library</p>
            <p className="text-xs text-zinc-500">Browse, and add your own</p>
          </div>
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
    <Block className={`card overflow-hidden ${isActive ? 'border-volt/30' : ''}`}>
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isActive && <Star size={14} className="shrink-0 text-volt" fill="currentColor" />}
            <h2 className="truncate font-display text-2xl font-bold">{plan.name}</h2>
          </div>
          <p className="text-sm text-zinc-500">
            {routines.length} routine{routines.length === 1 ? '' : 's'}
            {plan.schedule ? ' · weekly schedule' : ' · no schedule'}
          </p>
        </div>
        <Tap onClick={onEdit} aria-label={`Edit ${plan.name}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-zinc-400">
          <Pencil size={15} />
        </Tap>
      </div>
      <div className="space-y-2 px-5 pb-5">
        {routines.length === 0 && <p className="text-sm text-zinc-500">No routines in this plan yet.</p>}
        {routines.map((r) => (
          <RoutineRow key={r.id} routine={r} onStart={onStart} />
        ))}
      </div>
      {!isActive && (
        <Tap onClick={() => setActivePlan(plan.id)} className="w-full border-t border-line py-3 text-sm font-medium text-zinc-400">
          Make this my plan
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
        <p className="truncate text-xs text-zinc-500">
          {ready ? `${routine.exercises.length} exercises · ${sets} sets` : 'No exercises yet — tap to build it'}
          {routine.muscles.length > 0 && ` · ${muscleLabel(routine.muscles)}`}
        </p>
        {ready && (
          <p className="mt-1 truncate text-xs text-zinc-600">
            {routine.exercises
              .slice(0, 3)
              .map((e) => `${e.name} ${e.sets.length}×${repLabel(e.sets[0])}`)
              .join(' · ')}
            {routine.exercises.length > 3 && ' …'}
          </p>
        )}
      </motion.button>
      <Tap
        onClick={() => onStart(routine)}
        disabled={!ready}
        aria-label={`Start ${routine.name}`}
        className="grid w-14 shrink-0 place-items-center rounded-2xl bg-volt text-ink disabled:bg-surface-2 disabled:text-zinc-600"
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

      <p className="pt-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Routines in this plan</p>
      {routines.length === 0 ? (
        <p className="text-sm text-zinc-500">No routines yet. Create the plan, then add routines to it.</p>
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
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${on ? 'bg-volt/10 text-volt' : 'bg-surface-2 text-zinc-300'}`}
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

      <p className="px-1 text-xs text-zinc-600">Scheduling comes later. For now you plan days by hand, here or in your schedule app.</p>

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
