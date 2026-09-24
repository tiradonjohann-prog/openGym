import { describe, it, expect } from 'vitest'
import { bodyPartLabel, equipmentLabel, mechanicsLabel, lateralityLabel, weightTypeLabel, muscleLabel } from './exerciseLabels.js'

describe('exerciseLabels', () => {
  it('translates known body parts', () => {
    expect(bodyPartLabel('CHEST')).toBe('Pectoraux')
    expect(bodyPartLabel('CARDIO')).toBe('Cardio')
  })
  it('translates known equipment codes', () => {
    expect(equipmentLabel('PULL_UP_BAR')).toBe('Barre de traction')
  })
  it('routes the body-weight sentinel through the legacy t() dictionary', () => {
    expect(equipmentLabel('body weight')).toBe('body weight') // t() with no fr.js loaded in test env falls back to the key
  })
  it('falls back to a prettified code for unknown values', () => {
    expect(equipmentLabel('SOME_NEW_CODE')).toBe('Some New Code')
  })
  it('translates mechanics/laterality/weight type', () => {
    expect(mechanicsLabel('COMPOUND')).toBe('Polyarticulaire')
    expect(lateralityLabel('BILATERAL')).toBe('Bilatéral')
    expect(weightTypeLabel('BODYWEIGHT')).toBe('Poids du corps')
  })
  it('translates known muscles and falls back to prettified key', () => {
    expect(muscleLabel('CHEST_MIDDLE')).toBe('Pectoral moyen')
    expect(muscleLabel('UNKNOWN_MUSCLE')).toBe('Unknown Muscle')
  })
})
