import { describe, it, expect } from 'vitest'
import { foldSetsIntoBests, prKindOf } from './prs.js'

describe('foldSetsIntoBests', () => {
  it('does not mutate the bests object it is given', () => {
    const bests = { weight: 10, byReps: { 8: 10 }, e1rm: 12 }
    foldSetsIntoBests(bests, [{ w: 20, r: 8, done: true }], -1)
    expect(bests).toEqual({ weight: 10, byReps: { 8: 10 }, e1rm: 12 })
  })

  it('raises weight to the heaviest already-done set in the list', () => {
    const bests = { weight: 10, byReps: {}, e1rm: 0 }
    const sets = [
      { w: 20, r: 8, done: true },
      { w: 0, r: 8, done: false },
    ]
    const out = foldSetsIntoBests(bests, sets, -1)
    expect(out.weight).toBe(20)
  })

  it('ignores the set at excludeIndex (the one currently being toggled)', () => {
    const bests = { weight: 10, byReps: {}, e1rm: 0 }
    const sets = [{ w: 999, r: 8, done: true }]
    const out = foldSetsIntoBests(bests, sets, 0)
    expect(out.weight).toBe(10)
  })

  it('ignores sets that are not done', () => {
    const bests = { weight: 10, byReps: {}, e1rm: 0 }
    const sets = [{ w: 999, r: 8, done: false }]
    const out = foldSetsIntoBests(bests, sets, -1)
    expect(out.weight).toBe(10)
  })

  it('raises byReps for the specific rep count of an already-done set', () => {
    const bests = { weight: 20, byReps: { 8: 15 }, e1rm: 0 }
    const sets = [{ w: 18, r: 8, done: true }]
    const out = foldSetsIntoBests(bests, sets, -1)
    expect(out.byReps[8]).toBe(18)
  })
})

describe('prKindOf — same-session progression (the reported bug)', () => {
  it('a weaker set after a better one in the same session is not a PR', () => {
    // Historical (saved) all-time best was 15kg. This session already did
    // 30kg (a real PR) on an earlier set; now checking a later 20kg set,
    // which beats history but not what this session already achieved.
    const historical = { weight: 15, byReps: {}, e1rm: 0 }
    const sessionSets = [{ w: 30, r: 8, done: true }]
    const bests = foldSetsIntoBests(historical, sessionSets, -1)
    expect(prKindOf(bests, 20, 8)).toBeNull()
  })

  it('the first, better set in the session is still correctly flagged as a PR', () => {
    const historical = { weight: 15, byReps: {}, e1rm: 0 }
    // No other sets done yet this session (excludeIndex covers the set itself).
    const bests = foldSetsIntoBests(historical, [{ w: 30, r: 8, done: false }], 0)
    expect(prKindOf(bests, 30, 8)).toBe('weight')
  })
})
