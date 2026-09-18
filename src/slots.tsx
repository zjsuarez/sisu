import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarPlus, Check, Trash2 } from 'lucide-react'
import { deleteSlot, newId, saveSlot, useStore, ymd, type Slot } from './store'
import { btn, fmtDay, Sheet, Tap } from './ui'

type Draft = { id: string; date: string; start: string; end: string; routineId: string | null; isNew: boolean }

const addMinutes = (time: string, mins: number) => {
  const [h, m] = time.split(':').map(Number)
  const t = (h * 60 + m + mins) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

const blank = (): Draft => ({ id: newId(), date: ymd(Date.now()), start: '18:00', end: '19:15', routineId: null, isNew: true })
const toDraft = (s: Slot): Draft => ({ id: s.id, date: s.date, start: s.start, end: s.end, routineId: s.routineId, isNew: false })

/** Planned workouts. The schedule app plans into the same list, so anything added there shows up here. */
export function Plan() {
  const { slots, routines } = useStore()
  const [draft, setDraft] = useState<Draft | null>(null)
  const today = ymd(Date.now())
  const from = ymd(Date.now() - 7 * 86_400_000)
  const shown = slots.filter((s) => !s.sessionId && s.date >= from).slice(0, 8)
  const label = (s: Slot) => routines.find((r) => r.id === s.routineId)?.name ?? s.title ?? 'Gym'

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">Planned</h3>
        <Tap onClick={() => setDraft(blank())} className="flex items-center gap-1.5 text-sm text-zinc-400">
          <CalendarPlus size={16} /> Plan
        </Tap>
      </div>

      {shown.length === 0 ? (
        <div className="card p-5 text-center text-sm text-muted">Nothing planned</div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {shown.map((s) => {
              const missed = s.date < today
              return (
                <motion.button
                  key={s.id}
                  layout
                  exit={{ opacity: 0, scale: 0.97 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDraft(toDraft(s))}
                  className="card flex w-full items-center gap-4 p-4 text-left"
                >
                  <div className={`grid w-14 shrink-0 place-items-center rounded-xl py-1.5 ${missed ? 'bg-surface-2 text-zinc-500' : 'bg-accent/10 text-accent'}`}>
                    <span className="text-[10px] font-semibold uppercase">{s.date === today ? 'Today' : fmtDay(s.at).split(' ')[0]}</span>
                    <span className="font-display text-sm font-bold">{s.start}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{label(s)}</p>
                    <p className="text-xs text-zinc-500">
                      {fmtDay(s.at)} · {s.start}–{s.end}
                    </p>
                  </div>
                  {missed && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-zinc-500">missed</span>}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.isNew ? 'Plan a workout' : 'Edit plan'}>
        {draft && <Editor draft={draft} setDraft={setDraft} />}
      </Sheet>
    </>
  )
}

function Editor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft | null) => void }) {
  const { routines } = useStore()
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none focus:border-accent'

  return (
    <div className="space-y-4 pb-4">
      <label className="block">
        <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Day</span>
        <input type="date" value={draft.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className={`${field} mt-2`} />
      </label>

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">From</span>
          <input
            type="time"
            value={draft.start}
            onChange={(e) => e.target.value && set({ start: e.target.value, end: addMinutes(e.target.value, 75) })}
            className={`${field} mt-2`}
          />
        </label>
        <label className="flex-1">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">To</span>
          <input type="time" value={draft.end} onChange={(e) => e.target.value && set({ end: e.target.value })} className={`${field} mt-2`} />
        </label>
      </div>

      <p className="pt-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Routine</p>
      <div className="flex flex-wrap gap-2">
        {routines.map((r) => {
          const on = draft.routineId === r.id
          return (
            <Tap
              key={r.id}
              onClick={() => set({ routineId: on ? null : r.id })}
              className={`flex items-center gap-1 rounded-full border px-3.5 py-2 text-sm transition-colors ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-zinc-400'}`}
            >
              {on && <Check size={14} />} {r.name}
            </Tap>
          )
        })}
        {routines.length === 0 && <p className="text-sm text-muted">No routines</p>}
      </div>

      <div className="sticky bottom-0 -mx-5 flex gap-3 bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-6 pb-2">
        {!draft.isNew && (
          <Tap
            onClick={() => {
              deleteSlot(draft.id)
              setDraft(null)
            }}
            aria-label="Delete plan"
            className={`${btn.ghost} text-red-400`}
          >
            <Trash2 size={20} />
          </Tap>
        )}
        <Tap
          onClick={() => {
            // never writes sessionId: the slot is shared with the schedule app, so only changed fields go up
            saveSlot(draft.id, { date: draft.date, start: draft.start, end: draft.end, routineId: draft.routineId, title: null })
            setDraft(null)
          }}
          className={`${btn.primary} flex-1`}
        >
          {draft.isNew ? 'Add to plan' : 'Save'}
        </Tap>
      </div>
    </div>
  )
}
