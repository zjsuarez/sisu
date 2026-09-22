import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, ChartColumn, Dumbbell, House, Play, User } from 'lucide-react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ensurePattern, useStore } from './store'
import { fmtDuration, spring, useNow } from './ui'
import Today from './pages/Today'
import Workouts from './pages/Workouts'
import CalendarScreen from './pages/Calendar'
import Exercises from './pages/Exercises'
import ExerciseScreen from './pages/Exercise'
import RoutineEditor from './pages/Routine'
import PlanScreen from './pages/Plan'
import Session from './pages/Session'
import Progress from './pages/Progress'
import Profile from './pages/Profile'
import SignIn, { Splash } from './pages/SignIn'
import { Dialogs } from './dialog'

/** the one element that scrolls; pages that need the scroll position ask for it by id */
export const SCROLLER = 'app-scroll'
export const scroller = () => document.getElementById(SCROLLER)

const TABS = [
  { to: '/', label: 'Today', icon: House },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/progress', label: 'Progress', icon: ChartColumn },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function App() {
  const location = useLocation()
  const { user, plans, profile } = useStore()
  const fullScreen = location.pathname === '/session' || location.pathname.startsWith('/routine/')

  // a new screen starts at the top: the shell scrolls, so it would otherwise keep the last one's offset
  useEffect(() => {
    scroller()?.scrollTo({ top: 0 })
  }, [location.pathname])

  // keep the active plan's weekly pattern filled as the horizon moves; a no-op once it is
  useEffect(() => {
    if (user) ensurePattern()
  }, [user, plans, profile.activePlanId])

  // undefined = still restoring the saved sign-in from this device; that works offline, so no timeout to the sign-in screen
  if (user === undefined) return <Splash />
  if (!user) return <SignIn />

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div id={SCROLLER} className="flex-1 overflow-y-auto overscroll-contain">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Today />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercise/:id" element={<ExerciseScreen />} />
          <Route path="/plan/:id" element={<PlanScreen />} />
          <Route path="/routine/:id" element={<RoutineEditor />} />
          <Route path="/session" element={<Session />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      </div>

      <AnimatePresence>{!fullScreen && <TabBar key="tabs" />}</AnimatePresence>
      <Dialogs />
    </div>
  )
}

function TabBar() {
  const { active } = useStore()
  const navigate = useNavigate()
  const now = useNow(!!active)
  const sets = active?.exercises.flatMap((e) => e.sets) ?? []

  return (
    <motion.nav
      initial={{ y: 120 }}
      animate={{ y: 0 }}
      exit={{ y: 120 }}
      transition={spring}
      className="absolute inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-ink via-ink to-transparent px-4 pt-10"
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
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display font-semibold leading-tight">{active.routine}</span>
              <span className="block text-xs opacity-60">
                {sets.filter((s) => s.done).length}/{sets.length} sets
              </span>
            </span>
            <span className="font-display text-sm font-semibold tabular-nums">{fmtDuration(Math.round((now - active.startedAt) / 1000))}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex rounded-[1.75rem] bg-surface/90 p-1.5 backdrop-blur-xl">
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
