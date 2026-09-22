import { useLayoutEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, Dumbbell, Flame, Play, Timer, Trophy, Weight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fromKg, muscleLabel, startSession, stats, useStore, volume, ymd } from './store'
import { dayValues, levelOf, monthGrid, scale, yearColumns } from './calendar'
import { recentRecords } from './progress'
import { setText } from './sets'
import { Plan } from './slots'
import { Counter, fmtCompact, fmtDay, fmtDuration, fmtShortDay, Tap } from './ui'

/**
 * The dashboard is whatever the user has put on it. Each widget stands alone — it reads the store
 * itself — so the grid is just a list of ids in the order they chose.
 */
export type Widget = { id: string; name: string; size: 'third' | 'half' | 'full'; Render: () => React.ReactNode }

/** the grid is six columns, so a widget can take a third, a half or all of it */
export const SPAN = { third: 'col-span-2', half: 'col-span-3', full: 'col-span-6' } as const

/** One number and its name, the shape every small widget shares. */
function Stat({ icon: Icon, label, value, format }: { icon: typeof Flame; label: string; value: number; format?: (n: number) => string }) {
  return (
    <div className="card h-full p-3.5">
      <Icon size={16} className="text-accent" />
      <p className="mt-2 truncate font-display text-xl font-bold">
        <Counter value={value} format={format} />
      </p>
      <p className="truncate text-[10px] text-zinc-500">{label}</p>
    </div>
  )
}

function NextWorkout() {
  const { routines, sessions, slots, active } = useStore()
  const navigate = useNavigate()

  // today's plan wins; otherwise suggest the routine trained least recently (an empty routine is no use)
  const todaySlot = slots.find((s) => s.date === ymd(Date.now()) && !s.sessionId)
  const planned = todaySlot?.routineId ? routines.find((r) => r.id === todaySlot.routineId) : undefined
  const lastDone = (id: string) => sessions.find((s) => s.routineId === id)?.at ?? 0
  const next = planned ?? routines.filter((r) => r.exercises.length).sort((a, b) => lastDone(a.id) - lastDone(b.id))[0]

  const go = () => {
    if (!active && next) startSession(next, todaySlot?.id ?? null)
    navigate(active || next ? '/session' : '/workouts')
  }

  return (
    <div className="card p-6">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        {active ? 'In progress' : todaySlot ? (todaySlot.start ? `Today · ${todaySlot.start}` : 'Today') : 'Up next'}
      </p>
      <h2 className="mt-1 font-display text-5xl font-bold tracking-tight">{active?.routine ?? next?.name ?? 'Rest day'}</h2>
      <p className="mt-1 text-sm text-muted">
        {next || active ? `${(active ?? next).exercises.length} exercises${next && !active ? ` · ${muscleLabel(next.muscles)}` : ''}` : 'No routines'}
      </p>
      <Tap onClick={go} className="mt-6 flex items-center gap-2 rounded-2xl bg-accent px-5 py-3.5 font-display font-semibold text-ink">
        <Play size={18} fill="currentColor" /> {active ? 'Resume workout' : next ? 'Start workout' : 'Create routine'}
      </Tap>
    </div>
  )
}

/** This month, with the days you trained filled in. */
function TrainingCalendar() {
  const { sessions } = useStore()
  const navigate = useNavigate()
  const today = ymd(Date.now())
  const [year, month] = today.split('-').map(Number)
  const trained = new Set(sessions.map((s) => s.date))

  return (
    <Tap onClick={() => navigate('/calendar')} className="card w-full p-5 text-left">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">{new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long' })}</h3>
        <span className="text-xs text-zinc-500">{sessions.filter((s) => s.date.startsWith(today.slice(0, 7))).length} workouts</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-center text-[9px] text-zinc-600">
            {d}
          </span>
        ))}
        {monthGrid(year, month).map((date, i) =>
          !date ? (
            <span key={i} />
          ) : (
            <span
              key={date}
              className={`grid aspect-square place-items-center rounded-md text-[10px] font-semibold ${
                trained.has(date) ? 'bg-white/90 text-ink' : date === today ? 'text-white ring-1 ring-white/40' : 'bg-surface-2 text-zinc-600'
              }`}
            >
              {Number(date.slice(8))}
            </span>
          ),
        )}
      </div>
    </Tap>
  )
}

/** The week you are in: which days you trained, and which are still ahead. */
function WeekStrip() {
  const { sessions } = useStore()
  const st = stats(sessions)
  const done = st.weekDays.filter(Boolean).length

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold">This week</h3>
        <span className="text-xs text-zinc-500">{done} trained</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15 + i * 0.04, type: 'spring', stiffness: 500, damping: 25 }}
            className={`grid aspect-square place-items-center rounded-lg text-[11px] font-bold ${st.weekDays[i] ? 'bg-accent text-ink' : 'bg-surface-2 text-zinc-600'}`}
          >
            {d}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const SHADE = ['bg-surface-2', 'bg-white/15', 'bg-white/35', 'bg-white/60', 'bg-white']

/** A year of training as shades, newest week last. */
function StreakCalendar() {
  const { sessions, profile } = useStore()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const today = ymd(Date.now())
  const values = dayValues(sessions, profile.heatmap)
  const t = scale(values.values())
  const cols = yearColumns(today, 26) // half a year: a full one does not read at this size

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth
  }, [])

  return (
    <Tap onClick={() => navigate('/calendar')} className="card w-full p-5 text-left">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Flame size={16} className="text-accent" /> {stats(sessions).streak} day streak
        </h3>
        <span className="text-xs text-zinc-500">6 months</span>
      </div>
      <div ref={ref} className="overflow-x-auto">
        <div className="flex gap-[3px]">
          {cols.map((week, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {week.map((d) => (
                <span key={d} className={`size-[9px] shrink-0 rounded-[2px] ${d > today ? 'bg-transparent' : SHADE[levelOf(values.get(d) ?? 0, t, profile.heatmap)]}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Tap>
  )
}

function RecentPRs() {
  const { sessions, profile } = useStore()
  const navigate = useNavigate()
  const records = recentRecords(sessions, 3)

  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        <Trophy size={17} className="text-accent" /> Recent PRs
      </h3>
      {records.length === 0 ? (
        <p className="text-sm text-muted">None yet</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <Tap key={`${r.exerciseId}-${r.at}`} onClick={() => navigate(`/exercise/${r.exerciseId}`)} className="flex w-full items-center gap-3 text-left">
              <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
              <span className="shrink-0 font-display font-semibold tabular-nums">{setText(fromKg(r.set.weight, profile.unit), r.set)}</span>
              <span className="w-14 shrink-0 text-right text-xs text-zinc-600">{fmtShortDay(r.at)}</span>
            </Tap>
          ))}
        </div>
      )}
    </div>
  )
}

function Recent() {
  const { sessions, profile } = useStore()
  const navigate = useNavigate()

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">Recent</h3>
        <Tap onClick={() => navigate('/progress')} className="flex items-center text-sm text-muted">
          All <ChevronRight size={16} />
        </Tap>
      </div>
      {sessions.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">No workouts</div>
      ) : (
        <div className="space-y-2">
          {sessions.slice(0, 4).map((s) => (
            <Tap key={s.id} onClick={() => navigate(`/summary/${s.id}`)} className="card flex w-full items-center gap-4 p-4 text-left">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 font-display font-bold text-accent">{s.title.charAt(0)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="text-xs text-zinc-500">
                  {fmtDay(s.at)} · {fmtDuration(s.durationSec)}
                </p>
              </div>
              <p className="shrink-0 font-display font-semibold">
                {fmtCompact(fromKg(volume(s.exercises), profile.unit))}
                <span className="text-xs text-zinc-500"> {profile.unit}</span>
              </p>
            </Tap>
          ))}
        </div>
      )}
    </div>
  )
}

function Streak() {
  const { sessions } = useStore()
  return <Stat icon={Flame} label="Streak" value={stats(sessions).streak} />
}

function WeeklyVolume() {
  const { sessions, profile } = useStore()
  const v = fromKg(stats(sessions).weekVolume, profile.unit)
  return <Stat icon={Weight} label={`Week ${profile.unit}`} value={v} format={v >= 10_000 ? fmtCompact : undefined} />
}

function TotalSessions() {
  const { sessions } = useStore()
  return <Stat icon={Dumbbell} label="Workouts" value={sessions.length} />
}

function AverageDuration() {
  const { sessions } = useStore()
  const avg = sessions.length ? Math.round(sessions.reduce((t, s) => t + s.durationSec, 0) / sessions.length) : 0
  return (
    <div className="card h-full p-3.5">
      <Timer size={16} className="text-accent" />
      <p className="mt-2 truncate font-display text-xl font-bold tabular-nums">{fmtDuration(avg)}</p>
      <p className="truncate text-[10px] text-zinc-500">Average</p>
    </div>
  )
}

function Planned() {
  return (
    <div>
      <Plan />
    </div>
  )
}

export const WIDGETS: Widget[] = [
  { id: 'next', name: 'Next workout', size: 'full', Render: NextWorkout },
  { id: 'planned', name: 'Planned', size: 'full', Render: Planned },
  { id: 'calendar', name: 'Training calendar', size: 'full', Render: TrainingCalendar },
  { id: 'heat', name: 'Streak calendar', size: 'full', Render: StreakCalendar },
  { id: 'week', name: 'This week', size: 'full', Render: WeekStrip },
  { id: 'prs', name: 'Recent PRs', size: 'full', Render: RecentPRs },
  { id: 'recent', name: 'Recent workouts', size: 'full', Render: Recent },
  { id: 'streak', name: 'Workout streak', size: 'third', Render: Streak },
  { id: 'volume', name: 'Weekly volume', size: 'third', Render: WeeklyVolume },
  { id: 'sessions', name: 'Total sessions', size: 'third', Render: TotalSessions },
  { id: 'duration', name: 'Average duration', size: 'third', Render: AverageDuration },
]

export const widgetById = (id: string) => WIDGETS.find((w) => w.id === id)
