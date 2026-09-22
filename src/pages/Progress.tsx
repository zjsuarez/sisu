import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Trophy } from 'lucide-react'
import { fromKg, stats, useStore } from '../store'
import { deviceLabel } from '../sync'
import { Block, Counter, fmtCompact, fmtDuration, fmtTime, Page, spring } from '../ui'

export default function Progress() {
  const { sessions, profile, devices } = useStore()
  const navigate = useNavigate()
  const st = stats(sessions)
  const max = Math.max(1, ...st.weeks.map((w) => w.volume))
  const totalTime = sessions.reduce((t, s) => t + s.durationSec, 0)

  return (
    <Page subtitle="Every rep counts" title="Progress">
      <Block className="grid grid-cols-2 gap-3">
        <div className="card p-5">
          <p className="text-xs text-zinc-500">Total lifted</p>
          <p className="mt-1 font-display text-3xl font-bold">
            <Counter value={fromKg(st.totalVolume, profile.unit)} format={fmtCompact} />
            <span className="text-base text-zinc-500"> {profile.unit}</span>
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-zinc-500">Time training</p>
          <p className="mt-1 font-display text-3xl font-bold">{Math.round(totalTime / 3600)}<span className="text-base text-zinc-500"> h</span></p>
        </div>
      </Block>

      {/* weekly volume chart — ponytail: plain divs, add a chart lib when you need axes/tooltips */}
      <Block className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Weekly volume</h2>
          <span className="text-xs text-muted">8 weeks</span>
        </div>
        <div className="mt-6 flex h-40 items-end gap-2">
          {st.weeks.map((w, i) => {
            const current = i === st.weeks.length - 1
            return (
              <div key={w.from} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                {current && w.volume > 0 && <span className="text-[10px] font-semibold text-accent">{fmtCompact(fromKg(w.volume, profile.unit))}</span>}
                <motion.div
                  className={`w-full rounded-lg ${current ? 'bg-accent' : 'bg-surface-2'}`}
                  initial={{ height: 4 }}
                  animate={{ height: `max(4px, ${(w.volume / max) * 100}%)` }}
                  transition={{ ...spring, delay: 0.2 + i * 0.05 }}
                />
                <span className="text-[10px] text-zinc-500">{new Date(w.from).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })}</span>
              </div>
            )
          })}
        </div>
      </Block>

      <Block>
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
          <Trophy size={18} className="text-accent" /> Personal records
        </h2>
        {st.prs.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No records yet</div>
        ) : (
          <div className="card divide-y divide-line">
            {st.prs.map(({ id, name, set }) => (
              <button key={id} onClick={() => navigate(`/exercise/${id}`)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
                <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                <span className="font-display font-semibold tabular-nums">
                  {fromKg(set.weight, profile.unit)}
                  <span className="text-xs text-zinc-500">{profile.unit}</span> × {set.reps}
                </span>
                <ChevronRight size={16} className="shrink-0 text-zinc-600" />
              </button>
            ))}
          </div>
        )}
      </Block>

      <Block>
        <h2 className="mb-3 font-display text-xl font-semibold">History</h2>
        <div className="space-y-2">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => navigate(`/summary/${s.id}`)} className="card flex w-full items-center gap-3 p-4 text-left">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(s.at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} · {fmtDuration(s.durationSec)} ·{' '}
                  {s.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
                </p>
                <p className="truncate text-xs text-zinc-600">
                  {s.start} on {deviceLabel(s.deviceId, devices)} · {s.syncedAt ? `in the cloud ${fmtTime(s.syncedAt)}` : 'waiting to upload'}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-zinc-600" />
            </button>
          ))}
        </div>
      </Block>
    </Page>
  )
}
