import { useState } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, Pencil } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { exerciseHistory, fromKg, MUSCLES, resolve, useStore } from '../store'
import { points, summary } from '../progress'
import { ExerciseForm, type ExerciseDraft } from '../exerciseForm'
import { setText } from '../sets'
import { Block, fmtDay, Page, Sheet, Tap } from '../ui'

/** One exercise: what it is, how it has gone, and every time you did it. */
export default function Exercise() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useStore()
  const [draft, setDraft] = useState<ExerciseDraft | null>(null)

  const x = resolve(id)
  const history = exerciseHistory(id, 200) // sessions is already capped by what the account holds
  const pts = points(history)
  const sum = summary(pts)
  const kg = (v: number) => fromKg(v, profile.unit)

  return (
    <Page
      subtitle={
        <Tap onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted">
          <ChevronLeft size={16} /> Back
        </Tap>
      }
      title={x.name}
      action={
        x.custom && !x.modifiers.length ? (
          <Tap onClick={() => setDraft({ ...x, isNew: false })} aria-label={`Edit ${x.name}`} className="grid size-11 place-items-center rounded-full bg-surface-2 text-zinc-300">
            <Pencil size={17} />
          </Tap>
        ) : undefined
      }
    >
      <Block className="flex flex-wrap gap-2">
        <span className="rounded-full bg-accent/10 px-3 py-1.5 text-sm text-accent">{MUSCLES[x.base.muscle]}</span>
        {x.base.secondary.map((m) => (
          <span key={m} className="rounded-full bg-surface-2 px-3 py-1.5 text-sm text-zinc-400">
            {MUSCLES[m]}
          </span>
        ))}
        {x.modifiers.map((m) => (
          <span key={m.id} className="rounded-full bg-surface-2 px-3 py-1.5 text-sm text-zinc-400">
            {m.label}
          </span>
        ))}
      </Block>

      {x.base.description && <Block className="text-sm text-zinc-400">{x.base.description}</Block>}

      {!sum ? (
        <Block className="card p-6 text-center text-sm text-muted">Nothing logged yet</Block>
      ) : (
        <>
          <Block className="card p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest text-muted uppercase">Estimated 1RM</p>
                <p className="font-display text-4xl font-bold tabular-nums">
                  {kg(sum.last.e1rm).toFixed(1)}
                  <span className="text-lg text-zinc-500"> {profile.unit}</span>
                </p>
              </div>
              {sum.change !== null && (
                <p className={`font-display text-sm font-semibold tabular-nums ${sum.change >= 0 ? 'text-white' : 'text-zinc-500'}`}>
                  {sum.change >= 0 ? '+' : ''}
                  {kg(sum.change).toFixed(1)} {profile.unit}
                </p>
              )}
            </div>
            <Chart pts={pts} unit={profile.unit} convert={kg} />
          </Block>

          <Block className="grid grid-cols-3 gap-3">
            {[
              { label: 'Best 1RM', value: `${kg(sum.best.e1rm).toFixed(1)}` },
              { label: 'Heaviest', value: `${kg(sum.heaviest.set.weight)}` },
              { label: 'Sessions', value: String(sum.sessions) },
            ].map((s) => (
              <div key={s.label} className="card p-4">
                <p className="font-display text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-zinc-500">{s.label}</p>
              </div>
            ))}
          </Block>

          <Block>
            <h2 className="mb-3 font-display text-xl font-semibold">History</h2>
            <div className="space-y-2">
              {[...pts].reverse().map((p) => (
                <div key={p.at} className="card flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-500">{fmtDay(p.at)}</p>
                    <p className="mt-0.5 truncate font-display tabular-nums">
                      {history
                        .find((h) => h.at === p.at)
                        ?.sets.map((s) => setText(kg(s.weight), s))
                        .join('   ')}
                    </p>
                  </div>
                  <p className="shrink-0 font-display font-semibold tabular-nums">
                    {kg(p.e1rm).toFixed(1)}
                    <span className="text-xs text-zinc-500"> {profile.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </Block>
        </>
      )}

      <Sheet open={!!draft} onClose={() => setDraft(null)} title="Edit exercise">
        {draft && <ExerciseForm draft={draft} setDraft={(d) => (setDraft(d), d || navigate(-1))} />}
      </Sheet>
    </Page>
  )
}

/** e1RM over time. Plain SVG — a chart library for one line would be a dependency for nothing. */
function Chart({ pts, unit, convert }: { pts: ReturnType<typeof points>; unit: string; convert: (v: number) => number }) {
  const W = 100
  const H = 42
  // one session still draws: a flat line across, so the card never sits empty waiting for a second
  const series = pts.length === 1 ? [pts[0], pts[0]] : pts
  const values = series.map((p) => p.e1rm)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const flat = hi - lo < 0.001
  const x = (i: number) => (i / (series.length - 1)) * W
  const y = (v: number) => (flat ? H / 2 : H - 4 - ((v - lo) / (hi - lo)) * (H - 10))
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p.e1rm).toFixed(2)}`).join(' ')

  return (
    <div className="mt-5">
      <p className="text-[10px] text-zinc-600">
        {convert(hi).toFixed(1)} {unit}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1 h-32 w-full overflow-visible">
        <motion.path
          d={`${line} L${W},${H} L0,${H} Z`}
          fill="url(#fade)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <defs>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].e1rm)} r={2} fill="var(--color-accent)" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={`flex text-[10px] text-zinc-600 ${pts.length === 1 ? 'justify-center' : 'justify-between'}`}>
        <span>{fmtDay(pts[0].at)}</span>
        {pts.length > 1 && <span>{fmtDay(pts[pts.length - 1].at)}</span>}
      </div>
    </div>
  )
}

