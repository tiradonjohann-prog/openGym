import { describe, it, expect } from 'vitest'
import { calcCardioKcal, calcPace, dayCardioKcal } from './cardio.js'

describe('calcCardioKcal', () => {
  it('returns null when weightKg is missing', () => {
    expect(calcCardioKcal('run', null, 45, 8)).toBeNull()
  })

  it('returns null when durationMin is missing', () => {
    expect(calcCardioKcal('run', 75, null, 8)).toBeNull()
  })

  it('returns null for unknown activity type', () => {
    expect(calcCardioKcal('unknown', 75, 45, 8)).toBeNull()
  })

  it('calculates walking kcal with fixed MET 3.5', () => {
    // 3.5 × 75 × 1h = 262.5 → 263
    expect(calcCardioKcal('walk', 75, 60, null)).toBe(263)
  })

  it('calculates aquagym kcal with fixed MET 4.5', () => {
    // 4.5 × 70 × 1h = 315
    expect(calcCardioKcal('aqua', 70, 60, null)).toBe(315)
  })

  it('calculates swimming kcal with fixed MET 7.0', () => {
    // 7.0 × 60 × 0.5h = 210
    expect(calcCardioKcal('swim', 60, 30, null)).toBe(210)
  })

  it('returns positive kcal for running with distance', () => {
    const kcal = calcCardioKcal('run', 75, 45, 8)
    expect(kcal).toBeGreaterThan(0)
  })

  it('faster running yields more calories than slower running (same duration)', () => {
    const slow = calcCardioKcal('run', 75, 60, 8)   // ~8 km/h → MET 8.5
    const fast = calcCardioKcal('run', 75, 60, 14)  // ~14 km/h → MET 13.5
    expect(fast).toBeGreaterThan(slow)
  })

  it('cycling kcal increases with speed', () => {
    const easy = calcCardioKcal('bike', 70, 60, 12)  // ~12 km/h → MET 5.0
    const hard = calcCardioKcal('bike', 70, 60, 25)  // ~25 km/h → MET 12.0
    expect(hard).toBeGreaterThan(easy)
  })
})

describe('calcPace', () => {
  it('calculates speed in km/h with 1 decimal', () => {
    expect(calcPace(60, 10)).toBe(10.0)
  })

  it('returns null when distance is 0', () => {
    expect(calcPace(60, 0)).toBeNull()
  })

  it('returns null when duration is missing', () => {
    expect(calcPace(null, 10)).toBeNull()
  })

  it('returns null when distance is missing', () => {
    expect(calcPace(60, null)).toBeNull()
  })
})

describe('dayCardioKcal', () => {
  it('sums all sport entries for a date', () => {
    const log = { '2025-08-29': { sport: [{ kcal: 300 }, { kcal: 220 }] } }
    expect(dayCardioKcal(log, '2025-08-29')).toBe(520)
  })

  it('returns 0 when no sport is logged', () => {
    expect(dayCardioKcal({}, '2025-08-29')).toBe(0)
  })

  it('returns 0 when log is null', () => {
    expect(dayCardioKcal(null, '2025-08-29')).toBe(0)
  })

  it('ignores entries without a kcal field', () => {
    const log = { '2025-08-29': { sport: [{ kcal: 200 }, {}] } }
    expect(dayCardioKcal(log, '2025-08-29')).toBe(200)
  })
})
