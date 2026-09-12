import { AnimatePresence, motion } from 'motion/react'
import { ChartColumn, Dumbbell, House, Play, User } from 'lucide-react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { spring } from './ui'
import Today from './pages/Today'
import Workouts from './pages/Workouts'
import Session from './pages/Session'
import Progress from './pages/Progress'
import Profile from './pages/Profile'

const TABS = [
  { to: '/', label: 'Today', icon: House },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: ChartColumn },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function App() {
  const location = useLocation()
  const inSession = location.pathname === '/session'

  return (
    <>
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(215,255,62,0.10),transparent)]" />

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Today />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/session" element={<Session />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      <AnimatePresence>{!inSession && <TabBar key="tabs" />}</AnimatePresence>
    </>
  )
}

function TabBar() {
  const { active } = useStore()
  const navigate = useNavigate()

  return (
    <motion.nav
      initial={{ y: 120 }}
      animate={{ y: 0 }}
      exit={{ y: 120 }}
      transition={spring}
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4"
    >
      <AnimatePresence>
        {active && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/session')}
            className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-volt px-4 py-3 text-left text-ink"
          >
            <span className="relative grid size-8 place-items-center rounded-full bg-ink text-volt">
              <span className="absolute inset-0 animate-ping rounded-full bg-ink/40" />
              <Play size={14} fill="currentColor" />
            </span>
            <span className="flex-1 font-display font-semibold">{active.routine} in progress</span>
            <span className="text-sm font-medium">Resume →</span>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="mb-2 flex rounded-[1.75rem] border border-white/5 bg-surface/80 p-1.5 shadow-2xl shadow-black backdrop-blur-xl">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium">
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab" transition={spring} className="absolute inset-0 rounded-[1.35rem] bg-surface-2" />}
                <motion.span animate={{ scale: isActive ? 1.1 : 1 }} transition={spring} className={`relative ${isActive ? 'text-volt' : 'text-zinc-500'}`}>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                </motion.span>
                <span className={`relative ${isActive ? 'text-white' : 'text-zinc-500'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  )
}
