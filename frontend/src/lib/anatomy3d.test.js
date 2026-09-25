import { describe, it, expect } from 'vitest'
import { muscleKeyForMesh, exercisesTargeting } from './anatomy3d.js'

describe('muscleKeyForMesh', () => {
  it('resolves a known mesh name to its muscle key', () => {
    expect(muscleKeyForMesh('Latissimus dorsi muscle')).toBe('BACK_LATS')
  })

  it('resolves an L/R suffixed variant to the same key', () => {
    expect(muscleKeyForMesh('Latissimus dorsi muscle_l')).toBe('BACK_LATS')
    expect(muscleKeyForMesh('Latissimus dorsi muscle.R')).toBe('BACK_LATS')
  })

  it('returns null for an unknown mesh name', () => {
    expect(muscleKeyForMesh('Some Unrelated Object')).toBe(null)
  })
})

describe('exercisesTargeting', () => {
  it('returns a non-empty list for a common muscle key, sorted by descending activation', () => {
    const result = exercisesTargeting('CHEST_MIDDLE')
    expect(result.length).toBeGreaterThan(0)
    for (let i = 1; i < result.length; i++) {
      const prevVal = result[i - 1].exercise_muscles.CHEST_MIDDLE
      const curVal = result[i].exercise_muscles.CHEST_MIDDLE
      expect(prevVal).toBeGreaterThanOrEqual(curVal)
    }
  })

  it('returns an empty array for a muscle key no exercise targets', () => {
    expect(exercisesTargeting('NOT_A_REAL_KEY')).toEqual([])
  })
})
