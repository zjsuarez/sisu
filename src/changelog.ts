/**
 * What changed, newest first. Bump VERSION and add an entry in the same commit as the change —
 * this is what the app shows under Profile, and how you tell whether a phone is running the
 * latest build.
 */
export const VERSION = '1.10.0'

export type Release = { version: string; date: string; changes: string[] }

export const RELEASES: Release[] = [
  {
    version: '1.10.0',
    date: '2026-09-23',
    changes: ['Streak calendar widget: six months of training as shades', 'The small widgets take a third of the row, so three fit side by side'],
  },
  {
    version: '1.9.0',
    date: '2026-09-23',
    changes: [
      'The dashboard is yours to build: the pencil adds, reorders and removes widgets',
      'Widgets: next workout, planned days, training calendar, this week, recent PRs, recent workouts, streak, weekly volume, total sessions, average duration',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-09-23',
    changes: ['A workout’s summary splits in two: the numbers, and every exercise with its sets laid out one per line'],
  },
  {
    version: '1.7.0',
    date: '2026-09-23',
    changes: ['Any past workout opens its summary — tap one in the calendar or in the history on Progress'],
  },
  {
    version: '1.6.0',
    date: '2026-09-22',
    changes: [
      'Sets and exercises can be dropped mid-workout, not only added',
      'Last time’s weight and reps show under every exercise, and empty sets no longer hint "0"',
      'This changelog, with the version the app is running',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-09-22',
    changes: [
      'Finishing a workout opens a summary: duration, volume, sets, exercises and the records it set',
      'The exercise picker offers the variants you already use, not just the plain catalogue',
      'Rest timer is back, set in minutes and seconds under Profile, or None',
      'The chronometer counts hundredths',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-09-21',
    changes: [
      'Zen mode: one exercise on the whole screen, swipe for the next, history and notes behind the menu',
      'Every exercise has a page: estimated 1RM over time, best and heaviest, and every day you trained it',
      'RIR and RPE can be switched or turned off, and count towards the estimated 1RM',
      'Exercises can be reordered mid-workout',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-09-21',
    changes: [
      'Calendar: a year at a glance and a month you can plan into',
      'Plans can lay down a weekly pattern, filled eight weeks ahead',
      'A planned day can have no time at all',
      'Streaks survive up to three rest days',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-09-20',
    changes: ['Plans hold routines, each with its own screen', 'Exercise modifiers: one exercise, many variants, each with its own history'],
  },
  { version: '1.1.0', date: '2026-09-19', changes: ['Workouts log offline and sync when there is signal', 'Shared calendar with the Schedule app'] },
  { version: '1.0.0', date: '2026-09-12', changes: ['First version'] },
]
