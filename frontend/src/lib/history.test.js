import { describe, it, expect } from 'vitest'
import { modeOf, isTimed, fmtSec, setLabel, defaultConfig, buildSets, exLine, workoutVolume, effortOf, stepEffort, capEffort, isBw, isPerSide, sideReps, repStep, elapsedMs, swapRoutineExerciseAt, weekDayVolumes, bwTrend } from './history.js'
import { EXDB } from './exercises.js'

// Real ids out of the shipped catalogue, so the body-part fallback is exercised for real.
const CARDIO = EXDB.find(e => e.bp === 'CARDIO').id
// A *loaded* lift: the catalogue's first non-cardio entry is a sit-up, which since issue #32
// defaults to bodyweight and would quietly send every label test down the other path.
const LIFT = EXDB.find(e => e.bp !== 'CARDIO' && e.eq !== 'body weight').id
const BW = EXDB.find(e => e.eq === 'body weight').id

describe('modeOf', () => {
  it('falls back to the body part when a plan has no mode — every existing plan keeps working', () => {
    expect(modeOf({ id: CARDIO })).toBe('cardio')
    expect(modeOf({ id: LIFT })).toBe('reps')
    expect(modeOf({ id: 'no-such-exercise' })).toBe('reps')
    expect(modeOf({})).toBe('reps')
    expect(modeOf(null)).toBe('reps')
    expect(modeOf(undefined)).toBe('reps')
  })

  it('lets an explicit mode win over the body part', () => {
    expect(modeOf({ id: LIFT, mode: 'time' })).toBe('time')
    expect(modeOf({ id: CARDIO, mode: 'reps' })).toBe('reps')
    expect(modeOf({ id: CARDIO, mode: 'time' })).toBe('time')
  })

  it('ignores a mode it does not know rather than trusting a bad file', () => {
    expect(modeOf({ id: LIFT, mode: 'nonsense' })).toBe('reps')
    expect(modeOf({ id: CARDIO, mode: '' })).toBe('cardio')
  })

  it('exposes the timed check', () => {
    expect(isTimed({ id: LIFT, mode: 'time' })).toBe(true)
    expect(isTimed({ id: LIFT })).toBe(false)
  })
})

describe('fmtSec', () => {
  it('reads as a clock, not a pile of seconds', () => {
    expect(fmtSec(0)).toBe('0:00')
    expect(fmtSec(9)).toBe('0:09')
    expect(fmtSec(45)).toBe('0:45')
    expect(fmtSec(60)).toBe('1:00')
    expect(fmtSec(90)).toBe('1:30')
    expect(fmtSec(605)).toBe('10:05')
  })
  it('is defensive about junk input', () => {
    expect(fmtSec(-5)).toBe('0:00')
    expect(fmtSec(undefined)).toBe('0:00')
    expect(fmtSec(null)).toBe('0:00')
    expect(fmtSec(NaN)).toBe('0:00')
    expect(fmtSec(44.6)).toBe('0:45')
  })
})

describe('setLabel', () => {
  it('describes each mode in its own terms', () => {
    expect(setLabel(LIFT, { w: 60, r: 10 })).toBe('60×10')
    expect(setLabel(CARDIO, { min: 20, speed: 9 })).toBe('20 min @ 9 km/h')
    expect(setLabel(LIFT, { sec: 45, w: 0 }, { mode: 'time' })).toBe('0:45')
    expect(setLabel(LIFT, { sec: 90, w: 20 }, { mode: 'time' })).toBe('1:30 · 20')
  })

  it('reads a legacy set with no config exactly as before', () => {
    expect(setLabel(LIFT, { w: 0, r: 0 })).toBe('0×0')
    expect(setLabel(CARDIO, {})).toBe('0 min @ 0 km/h')
  })

  it('appends RIR when present, including a valid 0', () => {
    expect(setLabel(LIFT, { w: 60, r: 10, rir: 2 })).toBe('60×10 (RIR 2)')
    expect(setLabel(LIFT, { w: 60, r: 10, rir: 1.5 })).toBe('60×10 (RIR 1.5)')
    expect(setLabel(LIFT, { w: 60, r: 10, rir: 0 })).toBe('60×10 (RIR 0)')
  })

  it('says nothing about RIR on a set that never logged one', () => {
    expect(setLabel(LIFT, { w: 60, r: 10 })).toBe('60×10')
    // cleared in the UI: the key is dropped, but a null must read the same as absent
    expect(setLabel(LIFT, { w: 60, r: 10, rir: null })).toBe('60×10')
  })

  it('appends RPE for a set logged on that scale', () => {
    expect(setLabel(LIFT, { w: 60, r: 10, rpe: 8 })).toBe('60×10 (RPE 8)')
    expect(setLabel(LIFT, { w: 60, r: 10, rpe: 9.5 })).toBe('60×10 (RPE 9.5)')
    expect(setLabel(LIFT, { w: 60, r: 10, rpe: null })).toBe('60×10')
  })

  it('keeps each set on the scale it was logged with', () => {
    // switching the setting must not rewrite history: an old RIR set still reads as RIR
    expect(setLabel(LIFT, { w: 60, r: 10, rir: 2 })).toBe('60×10 (RIR 2)')
    // and a set that somehow carries both is described once, by the one it was logged with
    expect(setLabel(LIFT, { w: 60, r: 10, rir: 2, rpe: 8 })).toBe('60×10 (RIR 2)')
  })
})

describe('effortOf', () => {
  it('reads the scale a profile logs', () => {
    expect(effortOf({ effort: 'rpe' })).toBe('rpe')
    expect(effortOf({ effort: 'rir' })).toBe('rir')
    expect(effortOf({ effort: 'none' })).toBe('none')
    expect(effortOf({})).toBe('none')
  })

  it('keeps the column for a profile still carrying the old showRir flag', () => {
    expect(effortOf({ showRir: true })).toBe('rir')
    // what a stored profile actually looks like once it is overlaid on DEF
    expect(effortOf({ effort: null, showRir: true })).toBe('rir')
    expect(effortOf({ effort: null })).toBe('none')
    expect(effortOf({ showRir: false })).toBe('none')
    // once the new setting is chosen it wins, whatever the old flag said
    expect(effortOf({ showRir: true, effort: 'rpe' })).toBe('rpe')
    expect(effortOf({ showRir: true, effort: 'none' })).toBe('none')
  })

  // The store cannot be imported here (it reaches for `navigator` at module load), so the
  // overlay it performs is reproduced literally: stored profile spread over the defaults.
  // DEF.effort is null precisely so this lands on the showRir fallback rather than on 'none'.
  const overlay = stored => ({ unit: 'kg', effort: null, ...stored })

  it('survives the overlay every load path performs', () => {
    // upgrading with the column on: local state, a server pull and a restored backup all
    // arrive as a stored object spread over the defaults, and all must keep the column
    expect(effortOf(overlay({ showRir: true }))).toBe('rir')
    expect(effortOf(overlay({ showRir: false }))).toBe('none')
    // a profile predating the RIR feature entirely
    expect(effortOf(overlay({}))).toBe('none')
    // and one written by this version
    expect(effortOf(overlay({ effort: 'rpe' }))).toBe('rpe')
    // an old backup restored over a profile that had already chosen: the file wins, because
    // an import replaces state wholesale rather than merging
    expect(effortOf(overlay({ showRir: true, effort: undefined }))).toBe('rir')
  })

  it('is not fooled by a junk value', () => {
    expect(effortOf({ effort: 'rpe10' })).toBe('none')
    expect(effortOf({ effort: 'RIR' })).toBe('none')
    expect(effortOf({ effort: 'f' })).toBe('none')
    expect(effortOf(null)).toBe('none')
    expect(effortOf(undefined)).toBe('none')
    // a junk value with the old flag still set falls back rather than showing nothing
    expect(effortOf({ effort: 'nope', showRir: true })).toBe('rir')
  })
})

describe('stepEffort', () => {
  it('starts at the bottom of the scale and walks up', () => {
    // the first + on an empty cell lands on the lowest value, not on some "typical" middle:
    // the stepper counts up from the floor the way every other stepper in the app does
    expect(stepEffort('rir', null, 1)).toBe(0)
    expect(stepEffort('rpe', null, 1)).toBe(6)
    // and then in even steps
    expect(stepEffort('rir', 0, 1)).toBe(0.5)
    expect(stepEffort('rir', 0.5, 1)).toBe(1)
    expect(stepEffort('rpe', 6, 1)).toBe(6.5)
  })

  it('leaves an untouched cell unlogged when stepped down', () => {
    // one stray − on a fresh row must not stamp "(RIR 0)" — went to failure — on the set
    expect(stepEffort('rir', null, -1)).toBe(null)
    expect(stepEffort('rpe', null, -1)).toBe(null)
    expect(stepEffort('rir', undefined, -1)).toBe(null)
  })

  it('clears the cell again when stepped back off the floor', () => {
    // so a mistap is undoable rather than sticking at the floor for good
    expect(stepEffort('rir', 0, -1)).toBe(null)
    expect(stepEffort('rpe', 6, -1)).toBe(null)
    // but a step that stays inside the scale is an ordinary step
    expect(stepEffort('rir', 0.5, -1)).toBe(0)
    expect(stepEffort('rpe', 6.5, -1)).toBe(6)
  })

  it('stops at the top of the scale', () => {
    expect(stepEffort('rir', 9.5, 1)).toBe(10)
    expect(stepEffort('rir', 10, 1)).toBe(10)
    expect(stepEffort('rpe', 10, 1)).toBe(10)
  })

  it('keeps halves clean instead of drifting into float dust', () => {
    let v = null
    for (let i = 0; i < 6; i++) v = stepEffort('rpe', v, 1)
    expect(v).toBe(8.5)
    expect(stepEffort('rir', 0.1 + 0.2, 1)).toBe(0.8)
  })

  it('steps evenly from a value typed below the floor rather than snapping', () => {
    // nothing stops someone typing RPE 3; the stepper must not jump them to 6 on one tap
    expect(stepEffort('rpe', 3, 1)).toBe(3.5)
    // stepping down out of the scale from there just clears it
    expect(stepEffort('rpe', 3, -1)).toBe(null)
  })

  it('does nothing when the profile logs no effort at all', () => {
    expect(stepEffort('none', null, 1)).toBe(null)
    expect(stepEffort('none', 2, 1)).toBe(2)
    expect(stepEffort(undefined, 2, -1)).toBe(2)
  })
})

describe('capEffort', () => {
  it('caps a typed value at the top of the scale', () => {
    expect(capEffort('rir', 12)).toBe(10)
    expect(capEffort('rpe', 99)).toBe(10)
    expect(capEffort('rpe', 8)).toBe(8)
  })

  it('does not floor a typed value, so typing "10" survives its first keystroke', () => {
    // clamping up would turn the "1" of "10" into 6 and fight the input
    expect(capEffort('rpe', 1)).toBe(1)
    expect(capEffort('rir', 0)).toBe(0)
  })

  it('passes an emptied field through untouched', () => {
    expect(capEffort('rir', null)).toBe(null)
    expect(capEffort('rpe', undefined)).toBe(undefined)
    expect(capEffort('none', 12)).toBe(12)
  })
})

// End-to-end on the data, not the pixels: what a set carries after the taps a real session
// makes, and what it reads back as afterwards.
describe('logging effort across a session', () => {
  it('logs a working set on the chosen scale', () => {
    // four + taps from empty on an RPE profile: 6, 6.5, 7, 7.5
    let v = null
    for (let i = 0; i < 4; i++) v = stepEffort('rpe', v, 1)
    expect(setLabel(LIFT, { w: 80, r: 5, rpe: v })).toBe('80×5 (RPE 7.5)')
  })

  it('a set taken to failure is logged, not left blank', () => {
    const v = stepEffort('rir', null, 1)      // one + on an RIR profile
    expect(v).toBe(0)
    expect(setLabel(LIFT, { w: 100, r: 3, rir: v })).toBe('100×3 (RIR 0)')
  })

  it('switching the setting mid-history rewrites nothing', () => {
    const old = { w: 60, r: 10, rir: 2 }      // logged while the profile was on RIR
    const fresh = { w: 60, r: 10, rpe: 8 }    // logged after switching to RPE
    expect(effortOf({ effort: 'rpe' })).toBe('rpe')
    expect(setLabel(LIFT, old)).toBe('60×10 (RIR 2)')
    expect(setLabel(LIFT, fresh)).toBe('60×10 (RPE 8)')
    // turning the column off entirely hides the control but keeps both sets readable
    expect(effortOf({ effort: 'none' })).toBe('none')
    expect(setLabel(LIFT, old)).toBe('60×10 (RIR 2)')
  })

  it('never attaches effort to a mode that has no place for it', () => {
    // cardio and timed sets have no third stepper, and their labels ignore the field even
    // if an import or an old file put one there
    expect(setLabel(CARDIO, { min: 20, speed: 9, rpe: 8 })).toBe('20 min @ 9 km/h')
    expect(setLabel(LIFT, { sec: 45, rir: 2 }, { id: LIFT, mode: 'time' })).toBe('0:45')
  })
})

describe('defaultConfig', () => {
  it('gives each mode a sensible starting point', () => {
    expect(defaultConfig(LIFT)).toEqual({ sets: 3, reps: 10, repsPerSet: [10, 10, 10], weight: 0, mode: 'reps' })
    expect(defaultConfig(CARDIO)).toEqual({ sets: 1, min: 20, speed: 8 })
    expect(defaultConfig(LIFT, 'time')).toEqual({ sets: 3, sec: 45, weight: 0, mode: 'time' })
  })
  it('seeds the bodyweight flag from the catalogue, and only when it is true', () => {
    expect(defaultConfig(BW)).toEqual({ sets: 3, reps: 10, repsPerSet: [10, 10, 10], weight: 0, mode: 'reps', bodyweight: true })
    expect(defaultConfig(BW, 'time')).toEqual({ sets: 3, sec: 45, weight: 0, mode: 'time', bodyweight: true })
    expect('bodyweight' in defaultConfig(LIFT)).toBe(false)
  })
})

/* ---------- bodyweight and per side (issues #31/#32/#33) ---------- */

describe('isBw', () => {
  it('defaults from the catalogue so an existing plan needs no flag', () => {
    expect(isBw({ id: BW })).toBe(true)
    expect(isBw({ id: LIFT })).toBe(false)
  })
  it('lets the config win in both directions — a belt on a dip, a flag on a machine', () => {
    expect(isBw({ id: BW, bodyweight: false })).toBe(false)
    expect(isBw({ id: LIFT, bodyweight: true })).toBe(true)
  })
})

describe('sideReps', () => {
  it('halves the logged total, because the total is what was logged', () => {
    expect(sideReps(16)).toBe(8)
    expect(sideReps(0)).toBe(0)
  })
  it('shows an odd total as it falls rather than rounding the imbalance away', () => {
    expect(sideReps(17)).toBe(8.5)
  })
})

describe('exLine — per side never reaches a timed hold', () => {
  it('ignores a stale side flag on a hold, which has no reps to split', () => {
    expect(exLine({ id: LIFT, sets: 3, sec: 45, mode: 'time', side: true }, 'kg')).toBe('3 × 0:45')
  })
})

describe('repStep', () => {
  it('steps unilateral work in twos so the total stays splittable', () => {
    expect(repStep({ side: true })).toBe(2)
    expect(repStep({})).toBe(1)
    expect(repStep(null)).toBe(1)
  })
})

describe('setLabel — bodyweight', () => {
  it('reads as reps alone, because "0×12" describes nothing', () => {
    expect(setLabel(BW, { w: 0, r: 12 }, { id: BW })).toBe('12')
  })
  it('spells out a belt as an addition', () => {
    expect(setLabel(BW, { w: 10, r: 8 }, { id: BW })).toBe('+10 × 8')
  })
  it('logs a per-side set as the plain total, like every other set in the app', () => {
    expect(setLabel(BW, { w: 0, r: 16 }, { id: BW, side: true })).toBe('16')
    expect(setLabel(LIFT, { w: 20, r: 16 }, { id: LIFT, side: true })).toBe('20×16')
  })
  it('keeps the effort tail', () => {
    expect(setLabel(BW, { w: 0, r: 12, rir: 2 }, { id: BW })).toBe('12 (RIR 2)')
  })
})

describe('exLine', () => {
  it('shows the split where there is room for it, next to the total you log', () => {
    expect(exLine({ id: LIFT, sets: 3, reps: 16, side: true }, 'kg')).toBe('3 × 16 · 8/side')
  })
  it('marks added weight as added', () => {
    expect(exLine({ id: BW, sets: 3, reps: 8, weight: 10 }, 'kg')).toBe('3 × 8 · +10 kg')
  })
  it('summarises a planned exercise per mode', () => {
    expect(exLine({ id: LIFT, sets: 3, reps: 10 }, 'kg')).toBe('3 × 10')
    expect(exLine({ id: LIFT, sets: 3, reps: 10, weight: 60 }, 'kg')).toBe('3 × 10 · 60 kg')
    expect(exLine({ id: LIFT, sets: 3, sec: 45, mode: 'time' }, 'kg')).toBe('3 × 0:45')
    expect(exLine({ id: LIFT, sets: 2, sec: 90, weight: 20, mode: 'time' }, 'kg')).toBe('2 × 1:30 · 20 kg')
    expect(exLine({ id: CARDIO, sets: 1, min: 20, speed: 8 }, 'kg')).toBe('1 × 20 min @ 8 km/h')
  })
})

const emptyS = { workouts: [], exWeights: {} }

describe('buildSets', () => {
  it('builds reps sets from the plan when there is no history', () => {
    expect(buildSets(emptyS, { id: LIFT, sets: 3, reps: 8, weight: 50 }))
      .toEqual([{ w: 50, r: 8, done: false }, { w: 50, r: 8, done: false }, { w: 50, r: 8, done: false }])
  })

  it('builds timed sets, carrying the planned duration and load', () => {
    expect(buildSets(emptyS, { id: LIFT, mode: 'time', sets: 2, sec: 60, weight: 20 }))
      .toEqual([{ sec: 60, w: 20, done: false }, { sec: 60, w: 20, done: false }])
  })

  it('builds cardio sets unchanged', () => {
    expect(buildSets(emptyS, { id: CARDIO, sets: 1, min: 25, speed: 9 }))
      .toEqual([{ min: 25, speed: 9, done: false }])
  })

  it('carries last time\'s numbers forward within the same mode', () => {
    const S = { exWeights: {}, workouts: [{ d: '2026-01-01', entries: [{ id: LIFT, target: { mode: 'time' }, sets: [{ sec: 70, w: 10, done: true }] }] }] }
    expect(buildSets(S, { id: LIFT, mode: 'time', sets: 2, sec: 45, weight: 0 }))
      .toEqual([{ sec: 70, w: 10, done: false }, { sec: 70, w: 10, done: false }])
  })

  it('does not seed a duration from a rep count when an exercise switches to time', () => {
    const S = { exWeights: {}, workouts: [{ d: '2026-01-01', entries: [{ id: LIFT, sets: [{ w: 60, r: 10, done: true }] }] }] }
    expect(buildSets(S, { id: LIFT, mode: 'time', sets: 1, sec: 45, weight: 0 }))
      .toEqual([{ sec: 45, w: 0, done: false }])
  })

  it('does not seed reps from a timed set when an exercise switches back', () => {
    const S = { exWeights: {}, workouts: [{ d: '2026-01-01', entries: [{ id: LIFT, target: { mode: 'time' }, sets: [{ sec: 70, w: 10, done: true }] }] }] }
    expect(buildSets(S, { id: LIFT, mode: 'reps', sets: 1, reps: 8, weight: 40 }))
      .toEqual([{ w: 40, r: 8, done: false }])
  })

  it('still prefers the confirmed working weight for reps sets', () => {
    const S = { exWeights: { [LIFT]: { w: 75 } }, workouts: [{ d: '2026-01-01', entries: [{ id: LIFT, sets: [{ w: 60, r: 10, done: true }] }] }] }
    expect(buildSets(S, { id: LIFT, sets: 1, reps: 8, weight: 50 })).toEqual([{ w: 75, r: 10, done: false }])
  })
})

describe('workoutVolume', () => {
  it('counts reps work and leaves timed/cardio sets out — there is no weight × reps for a hold', () => {
    const w = { entries: [
      { id: LIFT, sets: [{ w: 60, r: 10, done: true }, { w: 60, r: 10, done: false }] },
      { id: LIFT, target: { mode: 'time' }, sets: [{ sec: 60, w: 20, done: true }] },
      { id: CARDIO, sets: [{ min: 20, speed: 9, done: true }] }
    ] }
    expect(workoutVolume(w)).toBe(600)
  })

  it('needs no per-side case — the logged reps are already both sides (issue #31)', () => {
    const w = { entries: [{ id: LIFT, target: { side: true }, sets: [{ w: 20, r: 16, done: true }] }] }
    expect(workoutVolume(w)).toBe(320)
  })

  it('leaves an unloaded bodyweight set at zero volume rather than inventing a number', () => {
    const w = { entries: [{ id: BW, target: { bodyweight: true }, sets: [{ w: 0, r: 20, done: true }] }] }
    expect(workoutVolume(w)).toBe(0)
  })
})

describe('elapsedMs', () => {
  const start = 1_000_000

  it('counts straight through when never paused', () => {
    expect(elapsedMs({ start }, start + 5000)).toBe(5000)
  })

  it('freezes at the moment it was paused', () => {
    const active = { start, pausedAt: start + 3000, pausedMs: 0 }
    expect(elapsedMs(active, start + 9000)).toBe(3000)
  })

  it('excludes a completed pause once resumed', () => {
    // paused for 2000ms total, then 4000ms more of real time passed
    const active = { start, pausedAt: null, pausedMs: 2000 }
    expect(elapsedMs(active, start + 2000 + 4000)).toBe(4000)
  })

  it('treats missing pausedAt/pausedMs as zero (backward compatible with old S.active shapes)', () => {
    expect(elapsedMs({ start }, start + 1000)).toBe(1000)
  })
})

describe('swapRoutineExerciseAt (review finding 3)', () => {
  it('rewrites the exercise at the given position in a plain (r.ex) routine', () => {
    const routine = { ex: [{ id: 'a' }, { id: 'b' }] }
    expect(swapRoutineExerciseAt(routine, 1, 'c')).toBe(true)
    expect(routine.ex).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('rewrites the exercise at the given position in a hybrid (r.items) routine, skipping block entries by position only', () => {
    const routine = { items: [{ kind: 'ex', id: 'a' }, { kind: 'block', type: 'run' }, { kind: 'ex', id: 'b' }] }
    expect(swapRoutineExerciseAt(routine, 2, 'c')).toBe(true)
    expect(routine.items[2]).toEqual({ kind: 'ex', id: 'c' })
  })

  it('is positional, not id-matched: rewrites the second occurrence of a repeated exercise without touching the first', () => {
    const routine = { ex: [{ id: 'a' }, { id: 'a' }] }
    expect(swapRoutineExerciseAt(routine, 1, 'c')).toBe(true)
    expect(routine.ex).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('returns false and changes nothing when the position holds a block, not an exercise', () => {
    const routine = { items: [{ kind: 'block', type: 'run' }] }
    expect(swapRoutineExerciseAt(routine, 0, 'c')).toBe(false)
    expect(routine.items).toEqual([{ kind: 'block', type: 'run' }])
  })

  it('returns false for an out-of-range index or a missing routine, without throwing', () => {
    expect(swapRoutineExerciseAt({ ex: [{ id: 'a' }] }, 5, 'c')).toBe(false)
    expect(swapRoutineExerciseAt(null, 0, 'c')).toBe(false)
  })
})

describe('weekDayVolumes', () => {
  it('buckets each workout into its weekday slot, Monday-first', () => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const isoAt = offset => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + offset)
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    }
    const mkWorkout = (d, w, r) => ({ d, entries: [{ sets: [{ done: true, w, r }] }] })
    const S = {
      workouts: [
        mkWorkout(isoAt(0), 100, 5),   // Monday: 500
        mkWorkout(isoAt(0), 20, 5),    // Monday, second workout same day: +100 = 600
        mkWorkout(isoAt(3), 50, 10),   // Thursday: 500
      ],
    }
    const result = weekDayVolumes(S)
    expect(result).toHaveLength(7)
    expect(result[0]).toBe(600)
    expect(result[3]).toBe(500)
    expect(result[1]).toBe(0)
  })

  it('returns all zeros when there are no workouts this week', () => {
    expect(weekDayVolumes({ workouts: [] })).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('ignores workouts from other weeks', () => {
    const S = { workouts: [{ d: '2020-01-01', entries: [{ sets: [{ done: true, w: 100, r: 10 }] }] }] }
    expect(weekDayVolumes(S)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe('bwTrend', () => {
  it('returns all nulls with no entries', () => {
    expect(bwTrend({ bodyweight: [] })).toEqual({
      bw: null, prevBW: null, delta: null, trendDir: null, totalDelta: null, firstBW: null,
    })
  })

  it('has no trend with a single entry', () => {
    const S = { bodyweight: [{ d: '2026-09-01', w: 80 }] }
    const r = bwTrend(S)
    expect(r.bw.w).toBe(80)
    expect(r.delta).toBeNull()
    expect(r.trendDir).toBeNull()
  })

  it('classifies a small change as stable (under 0.3)', () => {
    const S = { bodyweight: [{ d: '2026-09-01', w: 80 }, { d: '2026-09-02', w: 80.2 }] }
    expect(bwTrend(S).trendDir).toBe('stable')
  })

  it('classifies a gain as up and a loss as down', () => {
    const up = { bodyweight: [{ d: '2026-09-01', w: 80 }, { d: '2026-09-02', w: 81 }] }
    const down = { bodyweight: [{ d: '2026-09-01', w: 80 }, { d: '2026-09-02', w: 79 }] }
    expect(bwTrend(up).trendDir).toBe('up')
    expect(bwTrend(down).trendDir).toBe('down')
  })

  it('computes totalDelta from the very first entry, rounded to 1 decimal', () => {
    const S = { bodyweight: [{ d: '2026-09-01', w: 80 }, { d: '2026-09-10', w: 78.55 }] }
    expect(bwTrend(S).totalDelta).toBe(-1.5)
  })
})
