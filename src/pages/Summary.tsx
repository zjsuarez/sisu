import { motion } from 'motion/react'
import { Check, Trophy } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { fromKg, useStore, volume } from '../store'
import { newRecords } from '../progress'
import { setText } from '../sets'
import { btn, Counter, fmtCompact, fmtDuration, list, item, Tap } from '../ui'

/** What the workout came to, straight after finishing it. */
export default function Summary() {
  const { id = '' } = useParams()
  const { sessions, profile } = useStore()
  const navigate = useNavigate()

  const s = sessions.find((x) => x.id === id)
  if (!s) return <Navigate to="/" replace /> // deleted, or a link to a workout this device never had

  const kg = (v: number) => fromKg(v, profile.unit)
  const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0)
  const records = newRecords(s.exercises, sessions.filter((x) => x.at < s.at))

  const cards = [
    { label: `Volume ${profile.unit}`, value: kg(volume(s.exercises)), compact: true },
    { label: 'Sets', value: sets },
    { label: 'Exercises', value: s.exercises.length },
    { label: 'New PRs', value: records.length },
  ]

  return (
    <motion.main
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="safe-top mx-auto min-h-full max-w-md px-5 pb-32"
    >
      <motion.div variants={list} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={item} className="pt-10 pb-2 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-accent text-ink">
            <Check size={28} strokeWidth={3} />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Workout complete</h1>
          <p className="mt-1 text-sm text-muted">{s.title}</p>
          <p className="mt-6 font-display text-6xl font-bold tabular-nums">{fmtDuration(s.durationSec)}</p>
          <p className="text-xs tracking-widest text-zinc-600 uppercase">
            {s.start}–{s.end}
          </p>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="card p-5">
              <p className="font-display text-3xl font-bold tabular-nums">
                <Counter value={c.value} format={c.compact && c.value >= 10_000 ? fmtCompact : undefined} />
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{c.label}</p>
            </div>
          ))}
        </motion.div>

        {records.length > 0 && (
          <motion.div variants={item} className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <Trophy size={17} className="text-accent" /> New records
            </h2>
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.exerciseId} className="flex items-center justify-between gap-4">
                  <span className="min-w-0 truncate text-sm">{r.name}</span>
                  <span className="shrink-0 font-display font-semibold tabular-nums">{setText(kg(r.set.weight), r.set)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div variants={item} className="card divide-y divide-line">
          {s.exercises.map((e) => (
            <div key={e.exerciseId} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
              <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
              <span className="shrink-0 text-right text-xs text-zinc-500 tabular-nums">{e.sets.map((x) => setText(kg(x.weight), x)).join('  ')}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-ink via-ink to-transparent px-5 pt-10 pb-3">
        <Tap onClick={() => navigate('/', { replace: true })} className={`${btn.primary} w-full`}>
          Done
        </Tap>
      </div>
    </motion.main>
  )
}
