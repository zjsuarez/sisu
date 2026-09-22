import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronRight, Flame, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { dayValues, levelOf, monthGrid, monthsAround, scale, yearColumns, ymd } from '../calendar'
import { deleteSession, fromKg, setSettings, stats, useStore, volume, type Heatmap, type Session, type Slot } from '../store'
import { blankSlot, SlotEditor, slotTime, toDraft, type Draft } from '../slots'
import { Block, fmtDuration, Page, Sheet, Tap } from '../ui'
import { scroller } from '../App'
import { useNavigate } from 'react-router-dom'
import { ask } from '../dialog'

const METRICS: { id: Heatmap; label: string }[] = [
  { id: 'time', label: 'Time' },
  { id: 'sets', label: 'Sets' },
  { id: 'volume', label: 'Volume' },
  { id: 'plain', label: 'Plain' },
]

// level 0 is an untrained day; 1–4 climb towards white
const SHADE = ['bg-surface-2', 'bg-white/15', 'bg-white/35', 'bg-white/60', 'bg-white']

const group = <T extends { date: string }>(xs: T[]) => {
  const m = new Map<string, T[]>()
  for (const x of xs) m.set(x.date, [...(m.get(x.date) ?? []), x])
  return m
}

export default function Calendar() {
  const { sessions, slots, routines, profile } = useStore()
  const navigate = useNavigate()
  const today = ymd(Date.now())
  const [expanded, setExpanded] = useState(false)
  const [picking, setPicking] = useState(false)
  const [day, setDay] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const done = group(sessions)
  const planned = group(slots.filter((s) => !s.sessionId))
  const st = stats(sessions)
  const values = dayValues(sessions, profile.heatmap)
  const t = scale(values.values())

  // scrolling past the last month opens the full calendar; the X scrolls back to the year grid
  useEffect(() => {
    const el = scroller()
    if (!el) return
    const onScroll = () => {
      if (el.scrollHeight > el.clientHeight + 40 && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setExpanded(true)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  const collapse = () => {
    setExpanded(false)
    scroller()?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const label = (s: Slot) => routines.find((r) => r.id === s.routineId)?.name ?? s.title ?? 'Gym'
  const open = (date: string) => {
    setDay(date)
    setDraft(planned.get(date)?.[0] ? toDraft(planned.get(date)![0]) : blankSlot(date))
  }
  const close = () => {
    setDay(null)
    setDraft(null)
  }

  const monthProps = { today, done, planned, values, t, metric: profile.heatmap, label, onPick: open }

  return (
    <Page
      title="Calendar"
      subtitle={
        <>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs">
            <Flame size={12} /> {st.streak}
          </span>
        </>
      }
      action={
        <Tap onClick={() => setPicking(true)} aria-label="Heatmap settings" className="grid size-11 place-items-center rounded-full bg-surface-2 text-zinc-300">
          <SlidersHorizontal size={17} />
        </Tap>
      }
    >
      <Block className="card p-4">
        <Year today={today} values={values} t={t} metric={profile.heatmap} />
      </Block>

      <Block>
        <Month {...monthProps} year={Number(today.slice(0, 4))} month={Number(today.slice(5, 7))} />
      </Block>

      <Block>
        <Tap onClick={() => setExpanded(true)} aria-label="All months" className="flex w-full items-center justify-center gap-2 py-2 text-sm text-muted">
          <ChevronDown size={16} /> All months
        </Tap>
      </Block>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-20 overflow-y-auto bg-ink px-5 pb-36"
          >
            <Months {...monthProps} />
            <Tap
              onClick={collapse}
              aria-label="Close calendar"
              className="fixed right-5 bottom-28 z-10 grid size-12 place-items-center rounded-full bg-surface-2 text-zinc-300 shadow-lg shadow-black/40"
            >
              <X size={20} />
            </Tap>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Shade by">
        <div className="space-y-1 pb-4">
          {METRICS.map((m) => (
            <Tap
              key={m.id}
              onClick={() => {
                setSettings({ heatmap: m.id })
                setPicking(false)
              }}
              className={`w-full rounded-2xl px-4 py-3 text-left ${profile.heatmap === m.id ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-zinc-300'}`}
            >
              {m.label}
            </Tap>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!day} onClose={close} title={day ? new Date(`${day}T00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}>
        {day && (
          <div className="space-y-3 pb-2">
            {done.get(day)?.map((s) => (
              <Logged key={s.id} session={s} unit={profile.unit} onDeleted={close} onOpen={() => navigate(`/summary/${s.id}`)} />
            ))}
            {draft && <SlotEditor draft={draft} setDraft={(d) => (d ? setDraft(d) : close())} showDate={false} />}
          </div>
        )}
      </Sheet>
    </Page>
  )
}

function Logged({ session, unit, onDeleted, onOpen }: { session: Session; unit: 'kg' | 'lb'; onDeleted: () => void; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
      <Tap onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{session.title}</p>
          <p className="text-xs text-muted">
            {fmtDuration(session.durationSec)} · {Math.round(fromKg(volume(session.exercises), unit))} {unit}
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-zinc-500" />
      </Tap>
      <Tap
        onClick={async () => {
          if (!(await ask({ title: `Delete ${session.title}?`, body: 'The day goes back to planned.', confirm: 'Delete', danger: true }))) return
          deleteSession(session.id)
          onDeleted()
        }}
        aria-label={`Delete ${session.title}`}
        className="text-red-400"
      >
        <Trash2 size={18} />
      </Tap>
    </div>
  )
}

/** The year at a glance, a column per week. Scrolls sideways and starts on this week. */
function Year({ today, values, t, metric }: { today: string; values: Map<string, number>; t: number[]; metric: Heatmap }) {
  const ref = useRef<HTMLDivElement>(null)
  const cols = yearColumns(today)
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth
  }, [])

  return (
    <div ref={ref} className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1.5">
        <div className="flex gap-[3px]">
          {cols.map((week, i) => {
            // the midweek day decides which month a column belongs to, so each month is labelled once
            const turns = i > 0 && week[3].slice(0, 7) !== cols[i - 1][3].slice(0, 7)
            return (
              <span key={i} className="w-[9px] shrink-0 text-[9px] leading-none text-zinc-500">
                {turns ? new Date(`${week[3]}T00:00`).toLocaleDateString(undefined, { month: 'short' }) : ''}
              </span>
            )
          })}
        </div>
        <div className="flex gap-[3px]">
          {cols.map((week, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {week.map((d) => {
                const future = d > today
                const level = levelOf(values.get(d) ?? 0, t, metric)
                return (
                  <span key={d} title={d} className={`size-[9px] shrink-0 rounded-[2px] ${future ? 'bg-transparent' : SHADE[level]}`} />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type MonthProps = {
  year: number
  month: number
  today: string
  done: Map<string, Session[]>
  planned: Map<string, Slot[]>
  values: Map<string, number>
  t: number[]
  metric: Heatmap
  label: (s: Slot) => string
  onPick: (date: string) => void
  /** in the full-screen list the heading follows you down the month */
  sticky?: boolean
}

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function Month({ year, month, today, done, planned, label, onPick, sticky }: MonthProps) {
  const cells = monthGrid(year, month)
  const title = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const now = today.startsWith(`${year}-${String(month).padStart(2, '0')}`) // the month you are actually in, scrolling past the others

  return (
    <>
      <div className={sticky ? 'safe-top sticky top-0 z-10 -mx-5 bg-ink px-5 pb-1' : ''}>
        <h2 className={`mb-2 font-display text-lg font-semibold ${now ? 'text-white' : 'text-zinc-600'}`}>{title}</h2>
        <div className="mb-1 grid grid-cols-7 gap-1 pb-2">
          {WEEK_LETTERS.map((d, i) => (
            <span key={i} className="text-center text-[10px] text-zinc-600">
              {d}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={i} />
          const session = done.get(date)?.[0]
          const slot = planned.get(date)?.[0]
          const text = session?.title ?? (slot ? label(slot) : '')
          // filled in = trained; a dashed outline = only planned. Today is ringed on top of either.
          const fill = session ? 'bg-white/12' : ''
          const outline = slot && !session ? 'outline-1 outline-dashed outline-white/30 -outline-offset-2' : ''
          const ring = date === today ? 'ring-1 ring-white/50' : ''
          return (
            <Tap key={date} onClick={() => onPick(date)} className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 ${fill} ${outline} ${ring}`}>
              <span className={`font-display text-sm leading-none ${session ? 'font-bold text-white' : slot ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {Number(date.slice(8))}
              </span>
              {text && <span className={`w-full truncate text-center text-[9px] leading-tight ${session ? 'font-semibold text-white' : 'text-zinc-500'}`}>{text}</span>}
              {slot?.start && !session && <span className="text-[8px] leading-none text-zinc-600">{slotTime(slot).split('–')[0]}</span>}
            </Tap>
          )
        })}
      </div>
    </>
  )
}

/** Every month, this one in view. */
function Months(props: Omit<MonthProps, 'year' | 'month'>) {
  const here = useRef<HTMLDivElement>(null)
  const months = monthsAround(props.today, 12, 6)
  useEffect(() => here.current?.scrollIntoView(), [])

  return (
    <div className="mx-auto max-w-md">
      {months.map((m) => {
        const current = props.today.startsWith(`${m.year}-${String(m.month).padStart(2, '0')}`)
        return (
          <div key={`${m.year}-${m.month}`} ref={current ? here : undefined} className="scroll-mt-0 pb-6">
            <Month {...props} year={m.year} month={m.month} sticky />
          </div>
        )
      })}
    </div>
  )
}
