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

  // The male/female GLBs duplicate every muscle mesh 2-3x with an extra
  // infix before the side letter — e.g. "musclel" (base), "muscleol" ("o"
  // variant), "musclee1l"/"musclee2l" ("e"/"e1"/"e2" variants) — almost
  // certainly outline/shell duplicates for the toon-shader look. A raycast
  // hit on any of these duplicates has to resolve to the same key as the
  // base mesh, or clicking the body silently does nothing (the original bug
  // this stripping was written to fix).
  it('resolves the "o" duplicate-shell variant to the same key as the base mesh', () => {
    expect(muscleKeyForMesh('Latissimus_dorsi_muscleol')).toBe('BACK_LATS')
  })

  it('resolves the "e"/"e1"/"e2" duplicate-shell variants to the same key as the base mesh', () => {
    expect(muscleKeyForMesh('Latissimus_dorsi_muscleel')).toBe('BACK_LATS')
    expect(muscleKeyForMesh('Latissimus_dorsi_musclee1l')).toBe('BACK_LATS')
    expect(muscleKeyForMesh('Latissimus_dorsi_musclee2r')).toBe('BACK_LATS')
  })

  it('does not strip a real word that merely ends in one of the infix letters', () => {
    expect(muscleKeyForMesh('Some Unrelated Objecto')).toBe(null)
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
