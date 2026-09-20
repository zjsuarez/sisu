# Exercise catalogue re-cut + modifiers

**Status: implemented.** This is what the app does; `src/exercises.ts` is the code, `tests/naming.ts` checks the rules.

## Rules

1. **A variant is an id, not a record.** `bench-press` is the base, `bench-press~dumbbell` is a variant, `bench-press~dumbbell+close-grip+2ct-pause` has three. Nothing is stored: history, personal records and "what you lifted last time" already key on the exercise id, so a variant gets its own history for free.
2. **Modifiers never change the muscle.** A variant always counts towards its base's muscle.
3. **Any combination is allowed.** Close Grip and Wide Grip together is the user's business. Modifiers are sorted into a canonical order inside the id, so the same combination always produces the same id no matter what order they were picked in.
4. **Names stay as they are, and equipment never stacks.** A base is called what people call it: Bench Press, Barbell Row, Hammer Curl. Each one also records its default equipment, which is used two ways:
   - Picking that same equipment **collapses back to the base**, so the default can't silently split your history. Bench Press + Barbell is still Bench Press.
   - Picking a different one **replaces the equipment word if the name has one**, otherwise it's prefixed. Barbell Row + Dumbbell → **Dumbbell Row**, not "Dumbbell Barbell Row". Bench Press + Dumbbell → **Dumbbell Bench Press**.
5. **An entry that is only "modifier + existing exercise" is folded in.** Entries with a name of their own are kept, even when a modifier could express them (Sumo Deadlift, Hammer Curl).
6. **Old ids keep working.** Everything folded in becomes an alias to its variant id, so existing routines and logged workouts are untouched.

## Naming

**Prefix** (what it is), in this order: position/side → grip/stance → equipment → base name.
**Brackets** (how you did it): tempo, range of motion, bands, belt, and custom modifiers.

- `row~cable+seated` → **Seated Cable Row**
- `bench-press~close-grip+dumbbell` → **Close Grip Dumbbell Bench Press**
- `bench-press~2ct-pause+beltless` → **Bench Press (2ct Pause, Beltless)**
- `back-squat~low-bar+wide-stance+3ct-pause` → **Low Bar Wide Stance Back Squat (3ct Pause)**

The full name is snapshotted onto every logged workout, so history and the schedule app always show it in full even where the screen truncates.

## How a variant looks in the library

A variant shows its title plus the parts it's made of, so you can tell at a glance that it isn't a plain exercise:

```
 [icon]  3ct Pause Bench Press
         ( Bench Press )  +  ( 3ct Pause )
```

The base chip is highlighted, the modifiers are grey, and the icon marks it as modified.

**Which variants appear there:** the ones you actually use. They're derived from your routines and your logged workouts, so nothing extra is stored and the list can't fill up with combinations you tried once in a picker and abandoned.

## Modifier groups

| Group | Modifiers | In the name |
|---|---|---|
| Equipment | Dumbbell, Barbell, Cable, Machine, Smith Machine, Z Bar, Safety Bar, Trap Bar | prefix (replaces the base's equipment) |
| Stance/Grip | High Bar, Low Bar, Pronated, Supinated, Snatch Grip, Close Grip, Wide Grip, Neutral Grip, Close Stance, Wide Stance | prefix |
| Other | Unilateral, Seated, Standing, Lying, Feet Up, Goblet, Weighted, Assisted, Larsen, Clusters, Kodama | prefix |
| Tempo | 1ct / 2ct / 3ct / 5ct Pause, Low 2ct Pause, High 2ct Pause, 300 / 303 / 320 / 400 / 500 Tempo, Touch & Go | brackets |
| Range of Motion | Spoto, Low / Middle / High Pin, Low / High Block, Board, Box, Deficit | brackets |
| Load Accommodation | Band, Reverse Band | brackets |
| Accessories | Belt, Beltless | brackets |
| Your own | added with `+` under Other, stored per account | brackets |

## Base catalogue

The Equipment column is each exercise's **default** — it is not added to the name. It decides which equipment modifier collapses back to the base, and which word gets replaced when the name already contains one (Barbell Row → Dumbbell Row).

### Chest
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Bench Press | **barbell** | chest | triceps, shoulders |
| Incline Bench Press | **barbell** | chest | shoulders, triceps |
| Decline Bench Press | **barbell** | chest | triceps |
| Chest Fly | **dumbbell** | chest | |
| Crossover | **cable** | chest | |
| Chest Press | **machine** | chest | triceps, shoulders |
| Push-up | – | chest | triceps, core |
| Dip | – | chest | triceps |

### Back
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Deadlift | **barbell** | back | hamstrings, glutes, forearms |
| Sumo Deadlift | **barbell** | glutes | hamstrings, back |
| Row | **barbell** | back | biceps |
| T-Bar Row | – | back | biceps |
| Pull-up | – | back | biceps |
| Lat Pulldown | – | back | biceps |
| Face Pull | – | back | shoulders |
| Shrug | **barbell** | back | forearms |

### Shoulders
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Overhead Press | **barbell** | shoulders | triceps |
| Arnold Press | **dumbbell** | shoulders | triceps |
| Lateral Raise | **dumbbell** | shoulders | |
| Rear Delt Fly | **dumbbell** | shoulders | |
| Upright Row | **barbell** | shoulders | forearms |

### Biceps
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Curl | **barbell** | biceps | forearms |
| Hammer Curl | **dumbbell** | biceps | forearms |
| Preacher Curl | **barbell** | biceps | |
| Incline Curl | **dumbbell** | biceps | |

### Triceps
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Tricep Pushdown | – | triceps | |
| Overhead Tricep Extension | **dumbbell** | triceps | |
| Skull Crusher | **barbell** | triceps | |
| Tricep Kickback | **dumbbell** | triceps | |

### Forearms
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Wrist Curl | **barbell** | forearms | |
| Reverse Curl | **barbell** | forearms | biceps |
| Farmer's Walk | **dumbbell** | forearms | core |

### Core
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Plank | – | core | |
| Cable Crunch | – | core | |
| Hanging Leg Raise | – | core | |
| Ab Wheel | – | core | |
| Russian Twist | – | core | |
| Sit-up | – | core | |

### Quads
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Back Squat | **barbell** | quads | glutes, hamstrings |
| Front Squat | **barbell** | quads | glutes, core |
| Leg Press | – | quads | glutes |
| Hack Squat | – | quads | glutes |
| Bulgarian Split Squat | **dumbbell** | quads | glutes |
| Walking Lunge | **dumbbell** | quads | glutes |
| Leg Extension | – | quads | |

### Hamstrings
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Romanian Deadlift | **barbell** | hamstrings | glutes, back |
| Stiff-Leg Deadlift | **barbell** | hamstrings | glutes, back |
| Leg Curl | – | hamstrings | |
| Nordic Curl | – | hamstrings | |
| Good Morning | **barbell** | hamstrings | glutes, back |

### Glutes
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Hip Thrust | **barbell** | glutes | hamstrings |
| Glute Bridge | **barbell** | glutes | hamstrings |
| Kickback | **cable** | glutes | |

### Calves
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Calf Raise | – | calves | |

### Cardio
| Exercise | Equipment | Muscle | Also works |
|---|---|---|---|
| Treadmill Run | – | cardio | |
| Incline Walk | – | cardio | |
| Cycling | – | cardio | |
| Rowing Machine | – | cardio | back |
| Stair Climber | – | cardio | quads |
| Jump Rope | – | cardio | calves |

## Folded in (old id → variant)

These disappear from the list; their ids become aliases, so nothing in your history breaks.

| Was | Becomes | Shows as |
|---|---|---|
| Dumbbell Bench Press | `bench-press~dumbbell` | Dumbbell Bench Press |
| Incline Dumbbell Press | `incline-bench-press~dumbbell` | Incline Dumbbell Bench Press |
| Close-Grip Bench Press | `bench-press~close-grip` | Close Grip Bench Press |
| Cable Crossover | `crossover` | Cable Crossover |
| Barbell Row | `row` (name kept as Barbell Row) | Barbell Row |
| Dumbbell Row | `row~dumbbell` | Dumbbell Row |
| Seated Cable Row | `row~cable+seated` | Seated Cable Row |
| Chin-up | `pull-up~supinated` | Supinated Pull-up |
| Dumbbell Shoulder Press | `overhead-press~dumbbell` | Dumbbell Overhead Press |
| Barbell Curl | `curl` (name kept as Barbell Curl) | Barbell Curl |
| Dumbbell Curl | `curl~dumbbell` | Dumbbell Curl |
| Cable Curl | `curl~cable` | Cable Curl |
| Cable Kickback | `kickback` | Cable Kickback |
| Standing Calf Raise | `calf-raise~standing` | Standing Calf Raise |
| Seated Calf Raise | `calf-raise~seated` | Seated Calf Raise |
| Leg Press Calf Raise | `calf-raise~machine` | Machine Calf Raise |

## Known rough edges

- **Chin-up** renders as "Supinated Pull-up", which nobody says. Options: keep Chin-up as its own entry, or let a base override its name for one specific modifier.
- **Sumo Deadlift stays its own exercise** (your call), so Deadlift + Wide Stance is a second, separate way to log the same lift.
- **Machine-only movements** (Leg Press, Hack Squat, Leg Extension, Leg Curl, Lat Pulldown) carry no equipment word, so adding the Machine modifier makes a separate variant of something that is already a machine.

## Open questions

1. **Chin-up**: keep as its own exercise, or accept "Supinated Pull-up"?
2. **Machine-only movements** (Leg Press, Hack Squat, Leg Extension, Leg Curl, Lat Pulldown): fine that adding Machine makes a separate variant of something already on a machine?
3. **Tempo and range of motion in the name**: your mockup shows *"3ct Pause Bench Press"* (prefix), the rule above gives *"Bench Press (3ct Pause)"* (brackets). Brackets keep long stacks readable; prefix matches how you wrote it. Which?
