import { useState } from 'react'
import { ChevronLeft, Pencil, Plus, Star } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { setActivePlan, startSession, useStore, type Routine } from '../store'
import { PlanEditor, planStats, RoutineRow } from '../plans'
import { Block, btn, fmtShortDay, Page, Sheet, Tap } from '../ui'

export default function PlanScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { plans, routines, sessions, profile, active } = useStore()
  const [editing, setEditing] = useState(false)

  const plan = plans.find((p) => p.id === id)
  if (!plan) {
    navigate('/workouts', { replace: true })
    return null
  }

  const mine = plan.routineIds.map((r) => routines.find((x) => x.id === r)).filter((r): r is Routine => !!r)
  const st = planStats(plan, routines, sessions)
  const isActive = profile.activePlanId === plan.id

  const start = (r: Routine) => {
    if (active && !confirm(`Discard your ${active.routine} session in progress?`)) return
    startSession(r)
    navigate('/session')
  }

  return (
    <Page
      subtitle={
        <Tap onClick={() => navigate('/workouts')} className="flex items-center gap-1 text-muted">
          <ChevronLeft size={16} /> Workouts
        </Tap>
      }
      title={plan.name}
      action={
        <Tap onClick={() => setEditing(true)} aria-label={`Edit ${plan.name}`} className="grid size-11 place-items-center rounded-full bg-surface-2 text-zinc-300">
          <Pencil size={17} />
        </Tap>
      }
    >
      <Block className="card grid grid-cols-3 divide-x divide-line p-5">
        {[
          { label: 'Routines', value: String(st.routines) },
          { label: 'Workouts', value: String(st.workouts) },
          { label: st.startedAt ? 'Started' : 'Created', value: fmtShortDay(st.startedAt ?? st.createdAt) },
        ].map((x) => (
          <div key={x.label} className="px-2 text-center first:pl-0 last:pr-0">
            <p className="font-display text-xl font-bold">{x.value}</p>
            <p className="text-xs text-muted">{x.label}</p>
          </div>
        ))}
      </Block>

      {!isActive && (
        <Block>
          <Tap onClick={() => setActivePlan(plan.id)} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
            <Star size={16} /> Make active
          </Tap>
        </Block>
      )}

      <Block className="space-y-2">
        {mine.length === 0 && <p className="card p-5 text-center text-sm text-muted">No routines</p>}
        {mine.map((r) => (
          <RoutineRow key={r.id} routine={r} onStart={start} />
        ))}
      </Block>

      <Block>
        <Tap onClick={() => navigate(`/routine/new?plan=${plan.id}`)} className={`${btn.ghost} flex w-full items-center justify-center gap-2`}>
          <Plus size={18} /> New routine
        </Tap>
      </Block>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit plan">
        <PlanEditor plan={plan} onClose={() => setEditing(false)} onDeleted={() => navigate('/workouts', { replace: true })} />
      </Sheet>
    </Page>
  )
}
