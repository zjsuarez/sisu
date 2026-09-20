import { useEffect, useRef, type ReactNode } from 'react'
import { animate, AnimatePresence, motion, useDragControls, useInView, type HTMLMotionProps, type Variants } from 'motion/react'

export const spring = { type: 'spring', stiffness: 380, damping: 32 } as const

export const list: Variants = { show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }
export const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: spring },
}

export function Page({ title, subtitle, action, children }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="safe-top mx-auto min-h-full max-w-md px-5 pb-32"
    >
      <header className="flex items-end justify-between gap-4 pt-4 pb-6">
        <div>
          {subtitle && <div className="flex flex-wrap items-center gap-2 text-sm text-muted">{subtitle}</div>}
          <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
        </div>
        {action}
      </header>
      <motion.div variants={list} initial="hidden" animate="show" className="space-y-4">
        {children}
      </motion.div>
    </motion.main>
  )
}

/** Staggered block inside a Page. */
export const Block = (p: HTMLMotionProps<'section'>) => <motion.section variants={item} {...p} />

export function Tap({ className = '', ...p }: HTMLMotionProps<'button'>) {
  return <motion.button whileTap={{ scale: 0.95 }} transition={spring} className={`cursor-pointer select-none ${className}`} {...p} />
}

export const btn = {
  primary: 'rounded-2xl bg-accent px-5 py-3.5 font-display font-semibold text-ink',
  ghost: 'rounded-2xl bg-surface-2 px-5 py-3.5 font-medium text-zinc-300',
}

export function Ring({ value, size = 120, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-2" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.min(value, 1) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

const int = (n: number) => Math.round(n).toLocaleString()

// format must be stable (module-level), otherwise the count-up restarts every render
export function Counter({ value, format = int }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    const c = animate(0, value, { duration: 1, ease: [0.22, 1, 0.36, 1], onUpdate: (n) => ref.current && (ref.current.textContent = format(n)) })
    return () => c.stop()
  }, [value, inView, format])
  return <span ref={ref}>{format(0)}</span>
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const drag = useDragControls() // drag from the handle only, so content can scroll
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label={title}
            className="safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-[2rem] border-t border-line bg-surface px-5 pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
          >
            <div className="-mx-5 -mt-3 cursor-grab touch-none px-5 pt-3 pb-4" onPointerDown={(e) => drag.start(e)}>
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-700" />
              <h2 className="font-display text-2xl font-bold">{title}</h2>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export const fmtCompact = (n: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
export const fmtAgo = (t: number) => {
  const s = Math.round((t - Date.now()) / 1000)
  for (const [unit, sec] of [['day', 86_400], ['hour', 3_600], ['minute', 60]] as const) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit)
  return 'just now'
}

export const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
/** short enough to sit in a stat column without wrapping */
export const fmtShortDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
