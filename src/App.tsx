import { AnimatePresence, motion } from 'motion/react'
import { ChartColumn, Dumbbell, House, Play, User } from 'lucide-react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { spring } from './ui'
import Today from './pages/Today'
import Workouts from './pages/Workouts'
import Exercises from './pages/Exercises'
import RoutineEditor from './pages/Routine'
import Session from './pages/Session'
import Progress from './pages/Progress'
import Profile from './pages/Profile'
import SignIn, { Splash } from './pages/SignIn'

const TABS = [
  { to: '/', label: 'Today', icon: House },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: ChartColumn },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function App() {
  const location = useLocation()
  const { user } = useStore()
  const fullScreen = location.pathname === '/session' || location.pathname.startsWith('/routine/')

  // undefined = still restoring the saved sign-in from this device; that works offline, so no timeout to the sign-in screen
  if (user === undefined) return <Splash />
  if (!user) return <SignIn />

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Today />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/routine/:id" element={<RoutineEditor />} />
          <Route path="/session" element={<Session />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      <AnimatePresence>{!fullScreen && <TabBar key="tabs" />}</AnimatePresence>
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
            className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-left text-ink"
          >
            <span className="relative grid size-8 place-items-center rounded-full bg-ink text-accent">
              <span className="absolute inset-0 animate-ping rounded-full bg-ink/40" />
              <Play size={14} fill="currentColor" />
            </span>
            <span className="flex-1 font-display font-semibold">{active.routine}</span>
            <span className="text-sm font-medium">Resume</span>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="mb-2 flex rounded-[1.75rem] bg-surface/90 p-1.5 backdrop-blur-xl">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium">
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab" transition={spring} className="absolute inset-0 rounded-[1.35rem] bg-surface-2" />}
                <motion.span animate={{ scale: isActive ? 1.05 : 1 }} transition={spring} className={`relative ${isActive ? 'text-white' : 'text-muted'}`}>
                  <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                </motion.span>
                <span className={`relative ${isActive ? 'text-white' : 'text-muted'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  )
}
