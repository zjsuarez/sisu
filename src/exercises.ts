// The exercise catalogue. Built-ins ship here with stable ids, because logged sets point at ids:
// renaming an exercise must never split its history. The user's own exercises live in Firestore
// (users/{uid}/apps/gym/exercises) and get a uuid.

export const MUSCLES = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  core: 'Core', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', cardio: 'Cardio',
} as const

export type MuscleId = keyof typeof MUSCLES
export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[]
export const muscleLabel = (ids: MuscleId[]) => ids.map((m) => MUSCLES[m] ?? m).join(' · ')

export type Exercise = {
  id: string
  name: string
  muscle: MuscleId // the main one; this is what muscle summaries count
  secondary: MuscleId[] // helpers, deliberately not counted
  description: string | null
  custom?: boolean
}

const ex = (name: string, muscle: MuscleId, secondary: MuscleId[] = []): Exercise => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  muscle,
  secondary,
  description: null,
})

export const BUILT_IN: Exercise[] = [
  ex('Bench Press', 'chest', ['triceps', 'shoulders']),
  ex('Incline Bench Press', 'chest', ['shoulders', 'triceps']),
  ex('Dumbbell Bench Press', 'chest', ['triceps', 'shoulders']),
  ex('Incline Dumbbell Press', 'chest', ['shoulders', 'triceps']),
  ex('Chest Fly', 'chest'),
  ex('Cable Crossover', 'chest'),
  ex('Push-up', 'chest', ['triceps', 'core']),
  ex('Dip', 'chest', ['triceps']),

  ex('Deadlift', 'back', ['hamstrings', 'glutes', 'forearms']),
  ex('Barbell Row', 'back', ['biceps']),
  ex('Pull-up', 'back', ['biceps']),
  ex('Chin-up', 'back', ['biceps']),
  ex('Lat Pulldown', 'back', ['biceps']),
  ex('Seated Cable Row', 'back', ['biceps']),
  ex('T-Bar Row', 'back', ['biceps']),
  ex('Dumbbell Row', 'back', ['biceps']),
  ex('Face Pull', 'back', ['shoulders']),

  ex('Overhead Press', 'shoulders', ['triceps']),
  ex('Dumbbell Shoulder Press', 'shoulders', ['triceps']),
  ex('Arnold Press', 'shoulders', ['triceps']),
  ex('Lateral Raise', 'shoulders'),
  ex('Rear Delt Fly', 'shoulders'),
  ex('Upright Row', 'shoulders', ['forearms']),

  ex('Barbell Curl', 'biceps', ['forearms']),
  ex('Dumbbell Curl', 'biceps', ['forearms']),
  ex('Hammer Curl', 'biceps', ['forearms']),
  ex('Preacher Curl', 'biceps'),
  ex('Cable Curl', 'biceps'),
  ex('Incline Curl', 'biceps'),

  ex('Tricep Pushdown', 'triceps'),
  ex('Overhead Tricep Extension', 'triceps'),
  ex('Skull Crusher', 'triceps'),
  ex('Close-Grip Bench Press', 'triceps', ['chest']),
  ex('Tricep Kickback', 'triceps'),

  ex('Wrist Curl', 'forearms'),
  ex('Reverse Curl', 'forearms', ['biceps']),
  ex("Farmer's Walk", 'forearms', ['core']),

  ex('Plank', 'core'),
  ex('Cable Crunch', 'core'),
  ex('Hanging Leg Raise', 'core'),
  ex('Ab Wheel', 'core'),
  ex('Russian Twist', 'core'),
  ex('Sit-up', 'core'),

  ex('Back Squat', 'quads', ['glutes', 'hamstrings']),
  ex('Front Squat', 'quads', ['glutes', 'core']),
  ex('Leg Press', 'quads', ['glutes']),
  ex('Hack Squat', 'quads', ['glutes']),
  ex('Walking Lunge', 'quads', ['glutes']),
  ex('Bulgarian Split Squat', 'quads', ['glutes']),
  ex('Leg Extension', 'quads'),

  ex('Romanian Deadlift', 'hamstrings', ['glutes', 'back']),
  ex('Stiff-Leg Deadlift', 'hamstrings', ['glutes', 'back']),
  ex('Leg Curl', 'hamstrings'),
  ex('Nordic Curl', 'hamstrings'),
  ex('Good Morning', 'hamstrings', ['glutes', 'back']),

  ex('Hip Thrust', 'glutes', ['hamstrings']),
  ex('Glute Bridge', 'glutes', ['hamstrings']),
  ex('Cable Kickback', 'glutes'),
  ex('Sumo Deadlift', 'glutes', ['hamstrings', 'back']),

  ex('Standing Calf Raise', 'calves'),
  ex('Seated Calf Raise', 'calves'),
  ex('Leg Press Calf Raise', 'calves'),

  ex('Treadmill Run', 'cardio'),
  ex('Incline Walk', 'cardio'),
  ex('Cycling', 'cardio'),
  ex('Rowing Machine', 'cardio', ['back']),
  ex('Stair Climber', 'cardio', ['quads']),
  ex('Jump Rope', 'cardio', ['calves']),
]
