import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from 'lucide-react'
import { setSettings, useStore } from '../store'
import { widgetById, WIDGETS } from '../widgets'
import { SyncBadge } from '../sync'
import { Block, btn, item, Page, Sheet, spring, Tap } from '../ui'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening'
}

/** The dashboard: the widgets you chose, in the order you put them. */
export default function Today() {
  const { profile } = useStore()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  const shown = profile.widgets.map(widgetById).filter((w): w is NonNullable<typeof w> => !!w)
  const spare = WIDGETS.filter((w) => !profile.widgets.includes(w.id))
  const save = (ids: string[]) => setSettings({ widgets: ids })
  const move = (i: number, to: number) => {
    if (to < 0 || to >= shown.length) return
    const ids = shown.map((w) => w.id)
    ids.splice(to, 0, ...ids.splice(i, 1))
    save(ids)
  }

  return (
    <Page
      subtitle={
        <>
          {greeting()} <SyncBadge />
        </>
      }
      title={profile.name}
      action={
        <Tap
          onClick={() => setEditing((e) => !e)}
          aria-label={editing ? 'Done editing' : 'Edit dashboard'}
          className={`grid size-12 place-items-center rounded-full ${editing ? 'bg-accent text-ink' : 'bg-surface-2 text-zinc-300'}`}
        >
          {editing ? <Check size={22} /> : <Pencil size={19} />}
        </Tap>
      }
    >
      {shown.length === 0 && !editing && (
        <Block className="card p-6 text-center">
          <p className="font-display text-xl font-semibold">Empty dashboard</p>
          <Tap onClick={() => setEditing(true)} className={`${btn.primary} mt-5 w-full`}>
            Add a widget
          </Tap>
        </Block>
      )}

      {/* editing straightens the grid out into a list, so a widget can be moved without hunting for it */}
      {editing ? (
        <Block className="space-y-3">
          <AnimatePresence initial={false}>
            {shown.map((w, i) => (
              <motion.div key={w.id} layout transition={spring} exit={{ opacity: 0, scale: 0.97 }} className="rounded-3xl bg-surface-2/40 p-2">
                <div className="mb-2 flex items-center gap-1 px-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-300">{w.name}</span>
                  <Tap onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${w.name} up`} className="grid size-8 place-items-center rounded-full text-zinc-400 disabled:text-zinc-700">
                    <ArrowUp size={15} />
                  </Tap>
                  <Tap
                    onClick={() => move(i, i + 1)}
                    disabled={i === shown.length - 1}
                    aria-label={`Move ${w.name} down`}
                    className="grid size-8 place-items-center rounded-full text-zinc-400 disabled:text-zinc-700"
                  >
                    <ArrowDown size={15} />
                  </Tap>
                  <Tap
                    onClick={() => save(shown.filter((x) => x.id !== w.id).map((x) => x.id))}
                    aria-label={`Remove ${w.name}`}
                    className="grid size-8 place-items-center rounded-full text-red-400"
                  >
                    <X size={15} />
                  </Tap>
                </div>
                <div className="pointer-events-none">
                  <w.Render />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <Tap onClick={() => setAdding(true)} disabled={!spare.length} className={`${btn.ghost} flex w-full items-center justify-center gap-2 disabled:opacity-40`}>
            <Plus size={18} /> {spare.length ? 'Add widget' : 'All widgets added'}
          </Tap>
        </Block>
      ) : (
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          {shown.map((w) => (
            <div key={w.id} className={w.wide ? 'col-span-2' : ''}>
              <w.Render />
            </div>
          ))}
        </motion.div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add widget">
        <div className="space-y-1 pb-6">
          {spare.map((w) => (
            <Tap
              key={w.id}
              onClick={() => {
                save([...profile.widgets, w.id])
                setAdding(false)
              }}
              className="flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3.5 text-left font-medium text-zinc-300"
            >
              {w.name}
              <Plus size={16} className="text-muted" />
            </Tap>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}
