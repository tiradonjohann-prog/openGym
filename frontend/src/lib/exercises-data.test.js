// frontend/src/lib/exercises-data.test.js
import { describe, it, expect } from 'vitest'
import { EXDB } from './exercises-data.js'

describe('EXDB (generated catalog)', () => {
  it('has exactly 837 exercises (811 SmartWorkout + 26 residual cardio)', () => {
    expect(EXDB).toHaveLength(837)
  })

  it('every exercise has a unique id and the four compatibility aliases', () => {
    const ids = new Set()
    for (const ex of EXDB) {
      expect(ex.id).toBeTruthy()
      expect(ids.has(ex.id)).toBe(false)
      ids.add(ex.id)
      expect(ex.n).toBe(ex.name)
      expect(ex.bp).toBe(ex.body_part)
      expect(typeof ex.eq === 'string' || ex.eq === null).toBe(true)
    }
  })

  it('has 26 CARDIO exercises and no exercise uses the old lowercase body parts', () => {
    const cardio = EXDB.filter(e => e.body_part === 'CARDIO')
    expect(cardio).toHaveLength(26)
    const oldStyle = EXDB.filter(e => e.body_part === e.body_part.toLowerCase() && e.body_part !== e.body_part.toUpperCase())
    expect(oldStyle).toHaveLength(0)
  })

  it('SmartWorkout exercises have French instructions', () => {
    const smartworkout = EXDB.filter(e => e.body_part !== 'CARDIO')
    const missingFr = smartworkout.filter(e => !e.instructions?.fr?.length)
    expect(missingFr).toHaveLength(0)
  })
})
