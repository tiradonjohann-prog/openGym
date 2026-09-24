// The Push/Pull/Legs starter plan. Shared by the "Load starter plan" action in Settings
// and by the demo build, which seeds a history on top of exactly these routines.
import { uid } from './format.js'
import { EXDB } from './exercises.js'

// Exercises are listed by their exact catalog name, resolved to an id at runtime via
// findByName() below — not pinned to a specific id. The previous version of this file
// hardcoded ids from the pre-swap dataset, which broke outright when the catalog was
// replaced with SmartWorkout's (none of those ids exist any more); resolving by name
// means a future catalog regeneration that reshuffles ids (but keeps the same exercise
// names) won't need this file touched again.
const SPEC = [
  ['Push Day', 'barbell', '/assets/covers/push.svg', [
    ['Barbell Bench Press', 4, 8],
    ['Incline Barbell Bench Press', 3, 10],
    ['Barbell Overhead Press', 3, 10],
    ['Dumbbell Lateral Raise', 3, 12],
    ['Cable Triceps Pushdown', 3, 12],
    ['Dips', 3, 10],
  ]],
  ['Pull Day', 'pullup', '/assets/covers/pull.svg', [
    ['Cable Lat Pulldown', 4, 10],
    ['Barbell Bent Over Row', 4, 8],
    ['Seated Cable Row', 3, 10],
    ['Biceps Barbell Curl', 3, 10],
    ['Dumbbell Hammer Curl', 3, 12],
  ]],
  ['Leg Day', 'legs', '/assets/covers/legs.svg', [
    ['Barbell Squat', 4, 8],
    ['Romanian Deadlift', 3, 10],
    ['Leg Press', 3, 12],
    ['Seated Leg Extension Machine', 3, 12],
    ['Seated Leg Curl', 3, 12],
    ['Barbell Calf Raise', 4, 15],
  ]],
]

// name -> id, built once from the live catalog rather than baked in ahead of time.
let byName = null
function findByName(name) {
  if (!byName) {
    byName = new Map()
    EXDB.forEach(e => { if (!byName.has(e.n)) byName.set(e.n, e.id) })
  }
  return byName.get(name) || null
}

// Fresh routine objects (new ids) — [push, pull, legs]. An exercise whose exact name no
// longer exists in the catalog (a future regeneration renaming or dropping it) is left out
// rather than carried over as a dangling id — a slightly shorter routine beats one quietly
// full of "Unknown exercise" placeholders.
export const starterRoutines = () =>
  SPEC.map(([name, emoji, imageUrl, list]) => ({
    id: uid(), name, emoji, imageUrl,
    ex: list
      .map(([exName, sets, reps]) => ({ id: findByName(exName), sets, reps, weight: 0 }))
      .filter(cfg => cfg.id),
  }))
