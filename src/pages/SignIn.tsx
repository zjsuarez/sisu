import { motion } from 'motion/react'
import { LogIn } from 'lucide-react'
import { signIn, useStore } from '../store'
import { btn, spring, Tap } from '../ui'

const Logo = ({ size }: { size: number }) => <img src="./favicon.svg" alt="" width={size} height={size} className="rounded-[22%]" />

/** Shown while the saved sign-in is restored from this device (works offline). */
export function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <motion.div animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
        <Logo size={72} />
      </motion.div>
    </div>
  )
}

export default function SignIn() {
  const { authError, sync } = useStore()

  return (
    <main className="safe-top safe-bottom mx-auto flex h-full max-w-md flex-col justify-between px-6 pb-8">
      <div className="pt-[18vh]">
        <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={spring}>
          <Logo size={88} />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="mt-8 font-display text-6xl font-bold tracking-tight">
          Sisu
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }} className="mt-3 text-lg text-zinc-400">
          Train with grit. Track every set, on every device, with or without signal.
        </motion.p>
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.26 }} className="space-y-3">
        {authError && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{authError}</p>}
        {!sync.online && <p className="rounded-2xl bg-surface-2 p-3 text-sm text-zinc-400">You're offline. Signing in needs a connection the first time on each device.</p>}
        <Tap onClick={signIn} disabled={!sync.online} className={`${btn.primary} flex w-full items-center justify-center gap-2 disabled:opacity-40 disabled:shadow-none`}>
          <LogIn size={18} /> Continue with Google
        </Tap>
        <p className="text-center text-xs text-zinc-600">You'll be asked which Google account to use.</p>
      </motion.div>
    </main>
  )
}
