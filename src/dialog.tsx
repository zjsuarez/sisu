import { useEffect, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { btn, spring, Tap } from './ui'

/**
 * The app's own confirm/prompt. The native ones freeze the page, ignore the theme and look like
 * a browser in an installed app. `await ask(...)` reads the same as `confirm(...)` at the call site.
 */
type Request = {
  title: string
  body?: string
  confirm: string
  cancel: string | null // null = one button, nothing to decide
  danger?: boolean
  input?: { value: string; type: 'text' | 'time' }
  resolve: (value: boolean | string | null) => void
}

let open: Request | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (cb: () => void) => {
  subs.add(cb)
  return () => void subs.delete(cb)
}

function show(r: Omit<Request, 'resolve'>, resolve: Request['resolve']) {
  open?.resolve(open.input ? null : false) // a second question replaces the first, which counts as cancelled
  open = { ...r, resolve }
  emit()
}
function close(value: boolean | string | null) {
  open?.resolve(value)
  open = null
  emit()
}

/** true if they confirmed */
export const ask = (q: { title: string; body?: string; confirm?: string; cancel?: string; danger?: boolean }) =>
  new Promise<boolean>((resolve) => show({ ...q, confirm: q.confirm ?? 'OK', cancel: q.cancel ?? 'Cancel' }, (v) => resolve(v === true)))

/** what they typed, or null if they backed out */
export const askText = (q: { title: string; body?: string; value?: string; type?: 'text' | 'time'; confirm?: string }) =>
  new Promise<string | null>((resolve) =>
    show({ ...q, confirm: q.confirm ?? 'Save', cancel: 'Cancel', input: { value: q.value ?? '', type: q.type ?? 'text' } }, (v) => resolve(typeof v === 'string' ? v : null)),
  )

/** something to acknowledge, nothing to decide */
export const tell = (q: { title: string; body?: string }) => new Promise<void>((resolve) => show({ ...q, confirm: 'OK', cancel: null }, () => resolve()))

/** Mounted once, at the root. */
export function Dialogs() {
  const r = useSyncExternalStore(subscribe, () => open)
  const [text, setText] = useState('')

  useEffect(() => setText(r?.input?.value ?? ''), [r])
  useEffect(() => {
    if (!r) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close(r.input ? null : false)
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [r])

  return (
    <AnimatePresence>
      {r && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70 px-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => close(r.input ? null : false)}
        >
          <motion.form
            role="alertdialog"
            aria-label={r.title}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              close(r.input ? text : true)
            }}
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={spring}
            className="w-full max-w-xs rounded-3xl bg-surface p-6"
          >
            <h2 className="font-display text-xl font-bold">{r.title}</h2>
            {r.body && <p className="mt-2 text-sm text-muted">{r.body}</p>}
            {r.input && (
              <input
                type={r.input.type}
                value={text}
                autoFocus
                onChange={(e) => setText(e.target.value)}
                aria-label={r.title}
                className="mt-4 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3.5 text-center font-display text-lg outline-none focus:border-accent"
              />
            )}
            <div className="mt-6 flex gap-2">
              {r.cancel && (
                <Tap type="button" onClick={() => close(r.input ? null : false)} className={`${btn.ghost} flex-1`}>
                  {r.cancel}
                </Tap>
              )}
              <Tap type="submit" className={`flex-1 ${r.danger ? 'rounded-2xl bg-red-500/90 px-5 py-3.5 font-display font-semibold text-white' : btn.primary}`}>
                {r.confirm}
              </Tap>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
