import { describe, it, expect } from 'vitest'
import { activeProgramme, nextSession } from './programme.js'

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
