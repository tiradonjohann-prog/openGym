// frontend/src/lib/residual-cardio-data.test.js
import { describe, it, expect } from 'vitest'
import { RESIDUAL_CARDIO } from './residual-cardio-data.js'

describe('RESIDUAL_CARDIO', () => {
  it('has exactly 26 entries', () => {
    expect(RESIDUAL_CARDIO).toHaveLength(26)
  })

  it('every entry has required native fields and aliases', () => {
    for (const ex of RESIDUAL_CARDIO) {
      expect(ex.id).toBeTruthy()
      expect(ex.name).toBeTruthy()
      expect(ex.body_part).toBe('CARDIO')
      expect(Array.isArray(ex.equipments)).toBe(true)
      expect(ex.instructions.en.length).toBeGreaterThan(0)
      expect(ex.instructions.fr.length).toBe(ex.instructions.en.length)
      expect(ex.n).toBe(ex.name)
      expect(ex.bp).toBe('CARDIO')
      expect(ex.eq).toBe(ex.equipments.length ? ex.equipments[0] : 'body weight')
    }
  })

  it('ids are unique', () => {
    const ids = RESIDUAL_CARDIO.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
