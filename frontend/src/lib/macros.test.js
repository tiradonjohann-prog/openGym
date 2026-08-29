import { describe, it, expect } from 'vitest'
import { calcMacros, macroKcal } from './macros.js'

describe('calcMacros', () => {
  it('returns null when targetKcal is missing', () => {
    expect(calcMacros(null, 80, 'maintain', 3)).toBeNull()
  })

  it('returns null when weightKg is missing', () => {
    expect(calcMacros(2000, null, 'maintain', 3)).toBeNull()
  })

  it('uses active protein multiplier for ≥3 workouts/week', () => {
    const m = calcMacros(2100, 80, 'cut', 4)
    // 1.6 g/kg × 80 kg = 128 g
    expect(m.protG).toBe(128)
  })

  it('uses sedentary protein multiplier for <3 workouts/week', () => {
    const m = calcMacros(2000, 70, 'maintain', 1)
    // 0.83 g/kg × 70 kg = 58.1 → 58 g
    expect(m.protG).toBe(58)
  })

  it('uses high protein for recomp goal regardless of workout count', () => {
    const recomp = calcMacros(2000, 70, 'recomp', 0)
    const maint  = calcMacros(2000, 70, 'maintain', 0)
    expect(recomp.protG).toBeGreaterThan(maint.protG)
  })

  it('uses high protein for bulk goal', () => {
    const bulk = calcMacros(2400, 80, 'bulk', 0)
    const maint = calcMacros(2400, 80, 'maintain', 0)
    expect(bulk.protG).toBeGreaterThan(maint.protG)
  })

  it('total kcal from macros approximates targetKcal (within 15 kcal rounding)', () => {
    const m = calcMacros(2100, 80, 'cut', 4)
    expect(Math.abs(macroKcal(m) - 2100)).toBeLessThanOrEqual(15)
  })

  it('fiber is always 25 g', () => {
    expect(calcMacros(2100, 80, 'cut', 4).fiberG).toBe(25)
  })

  it('carbsG is never negative even in extreme cases', () => {
    const m = calcMacros(600, 100, 'bulk', 6)
    expect(m.carbsG).toBeGreaterThanOrEqual(0)
  })
})

describe('macroKcal', () => {
  it('calculates total kcal from macro grams', () => {
    // 100×4 + 200×4 + 50×9 = 400 + 800 + 450 = 1650
    expect(macroKcal({ protG: 100, carbsG: 200, fatG: 50, fiberG: 25 })).toBe(1650)
  })

  it('returns 0 for null', () => {
    expect(macroKcal(null)).toBe(0)
  })

  it('handles missing fields as 0', () => {
    expect(macroKcal({ protG: 100 })).toBe(400)
  })
})
