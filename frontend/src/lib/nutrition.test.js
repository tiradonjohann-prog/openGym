import { describe, it, expect } from 'vitest'
import { calcBMR, calcTDEE, ACTIVITY_MULT } from './nutrition.js'

describe('calcBMR', () => {
  // Male: 10×80 + 6.25×180 − 5×30 + 5 = 800 + 1125 − 150 + 5 = 1780
  it('matches Mifflin-St Jeor for a male', () => {
    expect(calcBMR('male', 80, 180, 30)).toBe(1780)
  })

  // Female: 10×60 + 6.25×165 − 5×25 − 161 = 600 + 1031.25 − 125 − 161 = 1345.25 → 1345
  it('matches Mifflin-St Jeor for a female', () => {
    expect(calcBMR('female', 60, 165, 25)).toBe(1345)
  })

  it('defaults to male formula for unrecognised sex values', () => {
    expect(calcBMR('other', 80, 180, 30)).toBe(calcBMR('male', 80, 180, 30))
  })

  it('returns null when any required value is missing', () => {
    expect(calcBMR('male', null, 180, 30)).toBeNull()
    expect(calcBMR('male', 80, null, 30)).toBeNull()
    expect(calcBMR('male', 80, 180, null)).toBeNull()
  })

  it('returns null for zero or negative inputs', () => {
    expect(calcBMR('male', 0, 180, 30)).toBeNull()
    expect(calcBMR('male', -80, 180, 30)).toBeNull()
    expect(calcBMR('male', 80, 0, 30)).toBeNull()
    expect(calcBMR('male', 80, 180, 0)).toBeNull()
  })
})

describe('calcTDEE', () => {
  const bmr = 1780

  // 1780 × 1.2 = 2136
  it('applies the sedentary multiplier with zero workouts', () => {
    expect(calcTDEE(bmr, 'sedentary', 0)).toBe(2136)
  })

  // 1780 × 1.2 + 1780 × (0.1/7) × 3 = 2136 + 76.28… → 2212
  it('adds the correct per-workout bonus', () => {
    expect(calcTDEE(bmr, 'sedentary', 3)).toBe(2212)
  })

  it('returns null when bmr is null', () => {
    expect(calcTDEE(null, 'moderate', 3)).toBeNull()
  })

  it('falls back to the sedentary multiplier for unknown activity levels', () => {
    expect(calcTDEE(bmr, 'unknown', 0)).toBe(calcTDEE(bmr, 'sedentary', 0))
  })

  it('higher workouts per week always yields a higher TDEE', () => {
    expect(calcTDEE(bmr, 'moderate', 5)).toBeGreaterThan(calcTDEE(bmr, 'moderate', 3))
  })

  it('treats undefined workouts the same as zero', () => {
    expect(calcTDEE(bmr, 'moderate', undefined)).toBe(calcTDEE(bmr, 'moderate', 0))
  })
})
