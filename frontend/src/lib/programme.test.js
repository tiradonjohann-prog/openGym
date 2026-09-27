import { describe, it, expect } from 'vitest'
import { activeProgramme, nextSession, workoutForProgSession, rewindProgrammeForDeletedWorkout, addRoutineToProgramme } from './programme.js'

const routine = (id, name = id) => ({ id, name, ex: [] })

describe('activeProgramme', () => {
  it('returns null when there are no programmes', () => {
    expect(activeProgramme({ programmes: [] })).toBe(null)
    expect(activeProgramme({})).toBe(null)
  })

  it('skips paused and complete programmes, returns the first eligible one', () => {
    const paused = { id: 'a', paused: true, totalWeeks: 4, routineIds: ['r1'], weekProgress: {} }
    const complete = { id: 'b', totalWeeks: 1, routineIds: ['r1'], weekProgress: { 1: [true] } }
    const active = { id: 'c', totalWeeks: 4, routineIds: ['r1'], weekProgress: {} }
    expect(activeProgramme({ programmes: [paused, complete, active] })).toBe(active)
  })

  it('returns null when every programme is paused or complete', () => {
    const paused = { id: 'a', paused: true, totalWeeks: 4, routineIds: ['r1'], weekProgress: {} }
    const complete = { id: 'b', totalWeeks: 1, routineIds: ['r1'], weekProgress: { 1: [true] } }
    expect(activeProgramme({ programmes: [paused, complete] })).toBe(null)
  })
})

describe('nextSession', () => {
  it('returns null for a null/paused/complete programme', () => {
    expect(nextSession(null, [])).toBe(null)
    expect(nextSession({ paused: true, totalWeeks: 4, routineIds: ['r1'], weekProgress: {} }, [])).toBe(null)
    const complete = { totalWeeks: 1, routineIds: ['r1'], weekProgress: { 1: [true] } }
    expect(nextSession(complete, [])).toBe(null)
  })

  it('resolves the next session in the current week, with its routine', () => {
    const prog = { currentWeek: 2, totalWeeks: 4, routineIds: ['push', 'pull'], weekProgress: { 2: [true, false] } }
    const routines = [routine('push'), routine('pull', 'Pull day')]
    expect(nextSession(prog, routines)).toEqual({
      routineId: 'pull', weekNum: 2, sessionIdx: 1, routine: routines[1],
    })
  })

  it('falls through to a later week when the recorded current week is already fully done', () => {
    // currentWeek not yet advanced by finishWorkout(), but week 2 is actually complete
    const prog = { currentWeek: 2, totalWeeks: 3, routineIds: ['push'], weekProgress: { 2: [true] } }
    const routines = [routine('push')]
    expect(nextSession(prog, routines)).toEqual({
      routineId: 'push', weekNum: 3, sessionIdx: 0, routine: routines[0],
    })
  })

  it('returns routine: null when the routine id no longer exists', () => {
    const prog = { currentWeek: 1, totalWeeks: 1, routineIds: ['gone'], weekProgress: {} }
    expect(nextSession(prog, [])).toEqual({
      routineId: 'gone', weekNum: 1, sessionIdx: 0, routine: null,
    })
  })
})

describe('nextSession — stale currentWeek (review finding 2)', () => {
  it('still finds an earlier incomplete week when currentWeek has drifted past totalWeeks after an edit', () => {
    // weeks 1-3 were complete under a 2-session/week programme; the programme was
    // then edited to 3 sessions/week and shortened to 3 weeks, leaving week 2 only
    // 2/3 done — but currentWeek (never touched by the edit) still says 4.
    const prog = {
      currentWeek: 4,
      totalWeeks: 3,
      routineIds: ['a', 'b', 'c'],
      weekProgress: { 1: [true, true, true], 2: [true, true, false], 3: [] },
    }
    expect(nextSession(prog, [])).toEqual({
      routineId: 'c', weekNum: 2, sessionIdx: 2, routine: null,
    })
  })
})

describe('workoutForProgSession', () => {
  const workouts = [
    { id: 'w1', programmeId: 'p1', progWeek: 1, progSessionIdx: 0 },
    { id: 'w2', programmeId: 'p1', progWeek: 1, progSessionIdx: 1 },
    { id: 'w3', programmeId: 'p1', progWeek: 2, progSessionIdx: 0 },
    { id: 'w4' }, // freestyle workout, no programme fields at all
  ]

  it('finds the workout matching programme id, week and session index exactly', () => {
    expect(workoutForProgSession(workouts, 'p1', 1, 1)).toBe(workouts[1])
    expect(workoutForProgSession(workouts, 'p1', 2, 0)).toBe(workouts[2])
  })

  it('returns null when nothing matches, including for a freestyle workout with no programme fields', () => {
    expect(workoutForProgSession(workouts, 'p1', 3, 0)).toBe(null)
    expect(workoutForProgSession(workouts, 'p-other', 1, 0)).toBe(null)
    expect(workoutForProgSession([], 'p1', 1, 0)).toBe(null)
  })
})

describe('rewindProgrammeForDeletedWorkout', () => {
  it('unmarks the session and rewinds currentWeek when it had advanced past that week', () => {
    const prog = { currentWeek: 4, totalWeeks: 8, routineIds: ['a', 'b'], weekProgress: { 2: [true, true] } }
    expect(rewindProgrammeForDeletedWorkout(prog, 2, 1)).toBe(true)
    expect(prog.weekProgress['2']).toEqual([true, false])
    expect(prog.currentWeek).toBe(2)
  })

  it('unmarks the session without touching currentWeek when the week is already current or in the future', () => {
    const prog = { currentWeek: 2, totalWeeks: 8, routineIds: ['a', 'b'], weekProgress: { 2: [true, true] } }
    expect(rewindProgrammeForDeletedWorkout(prog, 2, 0)).toBe(true)
    expect(prog.weekProgress['2']).toEqual([false, true])
    expect(prog.currentWeek).toBe(2)
  })

  it('returns false and changes nothing for a freestyle workout (no programme fields)', () => {
    const prog = { currentWeek: 2, totalWeeks: 8, routineIds: ['a'], weekProgress: { 1: [true] } }
    expect(rewindProgrammeForDeletedWorkout(prog, null, null)).toBe(false)
    expect(prog.weekProgress).toEqual({ 1: [true] })
    expect(prog.currentWeek).toBe(2)
  })

  it('returns false without throwing when the recorded week has no progress data at all (already-deleted programme, or stale data)', () => {
    const prog = { currentWeek: 1, totalWeeks: 8, routineIds: ['a'], weekProgress: {} }
    expect(rewindProgrammeForDeletedWorkout(prog, 5, 0)).toBe(false)
    expect(rewindProgrammeForDeletedWorkout(null, 1, 0)).toBe(false)
  })

  it('returns false for an ad-hoc workout (progSessionIdx null) — nothing to unmark', () => {
    const prog = { currentWeek: 2, totalWeeks: 8, routineIds: ['a'], weekProgress: { 2: [true] } }
    expect(rewindProgrammeForDeletedWorkout(prog, 2, null)).toBe(false)
    expect(prog.weekProgress['2']).toEqual([true])
  })
})

describe('addRoutineToProgramme', () => {
  it('appends the routine id to routineIds', () => {
    const prog = { totalWeeks: 2, routineIds: ['a'], weekProgress: {} }
    addRoutineToProgramme(prog, 'b')
    expect(prog.routineIds).toEqual(['a', 'b'])
  })

  it('backfills the new slot as done for weeks that were already fully complete', () => {
    const prog = { totalWeeks: 2, routineIds: ['a'], weekProgress: { 1: [true], 2: [false] } }
    addRoutineToProgramme(prog, 'b')
    expect(prog.weekProgress['1']).toEqual([true, true])   // week 1 was complete — backfilled
    expect(prog.weekProgress['2']).toEqual([false, false]) // week 2 wasn't — new slot padded pending, not just absent
  })

  it('pads an in-progress week (has an entry, not yet complete) so a later fill-in cannot wrongly mark the week done', () => {
    // Review finding: sheets.jsx's finishWorkout checks weekProgress[key].every(Boolean),
    // not routineIds.length — a short array for an in-progress week would let it read as
    // "all done" the moment the routines that existed before the append are finished,
    // even though the newly-added routine is still pending.
    const prog = { totalWeeks: 2, routineIds: ['a', 'b'], weekProgress: { 2: [true, false] } }
    addRoutineToProgramme(prog, 'c')
    expect(prog.weekProgress['2']).toEqual([true, false, false])
  })

  it('does not mutate weekProgress for a week that had no entry at all (never started, not complete)', () => {
    const prog = { totalWeeks: 3, routineIds: ['a'], weekProgress: { 1: [true] } }
    addRoutineToProgramme(prog, 'b')
    expect(prog.weekProgress['3']).toBeUndefined()
  })

  it('handles totalWeeks: 0 without throwing and without backfilling anything', () => {
    const prog = { totalWeeks: 0, routineIds: ['a'], weekProgress: {} }
    expect(() => addRoutineToProgramme(prog, 'b')).not.toThrow()
    expect(prog.routineIds).toEqual(['a', 'b'])
    expect(prog.weekProgress).toEqual({})
  })

  it('allows adding a routine id that is already present (a routine can occur twice a week)', () => {
    const prog = { totalWeeks: 1, routineIds: ['a'], weekProgress: {} }
    addRoutineToProgramme(prog, 'a')
    expect(prog.routineIds).toEqual(['a', 'a'])
  })

  it('initializes weekProgress when the programme had none at all', () => {
    const prog = { totalWeeks: 1, routineIds: ['a'] }
    expect(() => addRoutineToProgramme(prog, 'b')).not.toThrow()
    expect(prog.routineIds).toEqual(['a', 'b'])
  })
})
