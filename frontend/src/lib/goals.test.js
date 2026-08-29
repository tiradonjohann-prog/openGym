import { describe, it, expect } from 'vitest'
import { calcTargetKcal, isAggressiveDelta, GOAL_DEFAULT_DELTA, DELTA_MIN } from './goals.js'

describe('calcTargetKcal', () => {
  it('returns tdee when delta is 0', () => {
    expect(calcTargetKcal(2400, 0)).toBe(2400)
  })

  it('applies deficit for cut', () => {
    expect(calcTargetKcal(2400, -300)).toBe(2100)
  })

  it('applies surplus for bulk', () => {
    expect(calcTargetKcal(2400, 300)).toBe(2700)
  })

  it('returns null when tdee is null', () => {
    expect(calcTargetKcal(null, -300)).toBeNull()
  })

  it('treats undefined delta as 0', () => {
    expect(calcTargetKcal(2400, undefined)).toBe(2400)
  })
})

describe('isAggressiveDelta', () => {
  it('returns true when delta exceeds 20% of tdee', () => {
    // 501 / 2400 = 20.875% > 20%
    expect(isAggressiveDelta(2400, -501)).toBe(true)
  })

  it('returns false when delta is exactly 20% of tdee', () => {
    // 480 / 2400 = 20.0% — not strictly greater than
    expect(isAggressiveDelta(2400, -480)).toBe(false)
  })

  it('returns false when delta is 0', () => {
    expect(isAggressiveDelta(2400, 0)).toBe(false)
  })

  it('returns false when tdee is null', () => {
    expect(isAggressiveDelta(null, -500)).toBe(false)
  })
})

describe('GOAL_DEFAULT_DELTA', () => {
  it('maintain is 0', () => {
    expect(GOAL_DEFAULT_DELTA.maintain).toBe(0)
  })

  it('cut is negative', () => {
    expect(GOAL_DEFAULT_DELTA.cut).toBeLessThan(0)
  })

  it('bulk is positive', () => {
    expect(GOAL_DEFAULT_DELTA.bulk).toBeGreaterThan(0)
  })

  it('cut default stays within ANSES safe range', () => {
    expect(Math.abs(GOAL_DEFAULT_DELTA.cut)).toBeLessThanOrEqual(Math.abs(DELTA_MIN))
  })
})
