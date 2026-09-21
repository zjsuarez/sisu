import { useState } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, Dumbbell, Plus, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { newId, seedStarterPlan, startSession, useStore, type Plan, type Routine } from '../store'
import { PlanEditor, planStats, planSummary, RoutineRow } from '../plans'
import { Block, btn, Page, Sheet, Tap } from '../ui'
import { ask } from '../dialog'

const blankPlan = (): Plan => ({ id: newId(), name: '', routineIds: [], schedule: null, defaultStart: null, defaultMinutes: null, generatedThrough: null, createdAt: Date.now() })

export default function Workouts() {
  const { plans, routines, sessions, profile, active, importPending } = useStore()
  const navigate = useNavigate()
  const [creating, setCreating] = useState<Plan | null>(null)

  const loose = routines.filter((r) => !r.planId || !plans.some((p) => p.id === r.planId))
  const ordered = [...plans].sort((a, b) => Number(b.id === profile.activePlanId) - Number(a.id === profile.activePlanId) || a.createdAt - b.createdAt)

  const start = async (r: Routine) => {
    if (active && !(await ask({ title: 'Workout in progress', body: `Discard your ${active.routine} session and start this one?`, confirm: 'Discard', danger: true }))) return
    startSession(r)
    navigate('/session')
  }

  return (
    <Page
      subtitle={plans.length ? `${plans.length} plan${plans.length > 1 ? 's' : ''}` : undefined}
      title="Workouts"
      action={
        <Tap onClick={() => setCreating(blankPlan())} aria-label="New plan" className="grid size-12 place-items-center rounded-full bg-accent text-ink">
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

      {ordered.map((plan) => {
        const st = planStats(plan, routines, sessions)
        return (
          <Block key={plan.id}>
            <motion.button whileTap={{ scale: 0.99 }} onClick={() => navigate(`/plan/${plan.id}`)} className="card flex w-full items-center gap-2 p-5 text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {plan.id === profile.activePlanId && <Star size={13} className="shrink-0 text-white" fill="currentColor" />}
                  <h2 className="truncate font-display text-2xl font-bold">{plan.name}</h2>
                </div>
                <p className="truncate text-sm text-muted">{planSummary(st)}</p>
              </div>
              <ChevronRight size={20} className="shrink-0 text-muted" />
            </motion.button>
          </Block>
        )
      })}

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
        <Tap onClick={() => navigate('/exercises')} className="card flex w-full items-center gap-3 p-4 text-left">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-zinc-300">
            <Dumbbell size={18} />
          </div>
          <p className="flex-1 font-semibold">Exercises</p>
          <ChevronRight size={18} className="text-muted" />
        </Tap>
      </Block>

      <Sheet open={!!creating} onClose={() => setCreating(null)} title="New plan">
        {creating && <PlanEditor plan={creating} onClose={() => setCreating(null)} />}
      </Sheet>
    </Page>
  )
}
