import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarPlus, Check, Trash2 } from 'lucide-react'
import { addMinutes, deleteSlot, newId, saveSlot, useStore, ymd, type Slot } from './store'
import { btn, fmtDay, Sheet, Tap } from './ui'

export type Draft = { id: string; date: string; start: string | null; end: string | null; routineId: string | null; isNew: boolean }

export const blankSlot = (date = ymd(Date.now())): Draft => ({ id: newId(), date, start: null, end: null, routineId: null, isNew: true })
export const toDraft = (s: Slot): Draft => ({ id: s.id, date: s.date, start: s.start, end: s.end, routineId: s.routineId, isNew: false })

/** "18:00–19:15", or nothing at all when the day has no assigned time */
export const slotTime = (s: { start: string | null; end: string | null }) => (s.start ? `${s.start}–${s.end}` : '')

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
        <Tap onClick={() => setDraft(blankSlot())} className="flex items-center gap-1.5 text-sm text-zinc-400">
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
                    <span className="font-display text-sm font-bold">{s.start ?? new Date(s.at).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{label(s)}</p>
                    <p className="text-xs text-zinc-500">
                      {fmtDay(s.at)}
                      {s.start && ` · ${slotTime(s)}`}
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
        {draft && <SlotEditor draft={draft} setDraft={setDraft} />}
      </Sheet>
    </>
  )
}

const field = 'w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 outline-none focus:border-accent'
const chip = (on: boolean) => `rounded-full border px-4 py-2 text-sm ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-zinc-400'}`

export function SlotEditor({ draft, setDraft, showDate = true }: { draft: Draft; setDraft: (d: Draft | null) => void; showDate?: boolean }) {
  const { routines } = useStore()
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })

  return (
    <div className="space-y-4 pb-4">
      {showDate && (
        <label className="block">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Day</span>
          <input type="date" value={draft.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className={`${field} mt-2`} />
        </label>
      )}

      <div>
        <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Time</span>
        <div className="mt-2 flex gap-2">
          <Tap onClick={() => set({ start: null, end: null })} className={chip(!draft.start)}>
            None
          </Tap>
          <Tap onClick={() => !draft.start && set({ start: '18:00', end: '19:15' })} className={chip(!!draft.start)}>
            At a time
          </Tap>
        </div>
      </div>

      {draft.start && (
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
            <input type="time" value={draft.end ?? ''} onChange={(e) => e.target.value && set({ end: e.target.value })} className={`${field} mt-2`} />
          </label>
        </div>
      )}

      <p className="pt-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Routine</p>
      <div className="flex flex-wrap gap-2">
        {routines.map((r) => {
          const on = draft.routineId === r.id
          return (
            <Tap key={r.id} onClick={() => set({ routineId: on ? null : r.id })} className={`flex items-center gap-1 ${chip(on)}`}>
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
            // never writes sessionId: the slot is shared with the schedule app, so only changed fields go up.
            // generated: false marks it as touched by hand, so re-running a plan's pattern leaves it alone.
            saveSlot(draft.id, { date: draft.date, start: draft.start, end: draft.start ? draft.end : null, routineId: draft.routineId, title: null, generated: false })
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
