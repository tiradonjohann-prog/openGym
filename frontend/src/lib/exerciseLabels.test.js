import { describe, it, expect, vi } from 'vitest'
import { bodyPartLabel, mechanicsLabel, lateralityLabel, weightTypeLabel, muscleLabel } from './exerciseLabels.js'
import frDict from '../locales/fr.js'

// Mock the i18n module to include French translations for legacy equipment codes in tests
vi.mock('./i18n.js', async () => {
  return {
    t: (s, ...args) => {
      const v = frDict[s] || s
      for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
      return v
    },
    // Re-export other functions that might be needed
    getLang: () => 'fr',
    dateLocale: () => 'fr-FR',
    setLang: async () => {},
    useLang: () => 0,
  }
})

// Import after mocking
const { equipmentLabel } = await import('./exerciseLabels.js')

describe('exerciseLabels', () => {
  it('translates known body parts', () => {
    expect(bodyPartLabel('CHEST')).toBe('Pectoraux')
    expect(bodyPartLabel('CARDIO')).toBe('Cardio')
  })
  it('translates known equipment codes', () => {
    expect(equipmentLabel('PULL_UP_BAR')).toBe('Barre de traction')
  })
  it('routes the body-weight sentinel through the legacy t() dictionary', () => {
    expect(equipmentLabel('body weight')).toBe('poids du corps')
  })
  it('routes legacy equipment codes through t() when not in EQUIPMENT_LABELS_FR', () => {
    expect(equipmentLabel('leverage machine')).toBe('machine à levier')
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
  it('routes legacy muscle targets through t() when not in MUSCLE_LABELS_FR', () => {
    expect(muscleLabel('cardiovascular system')).toBe('système cardiovasculaire')
  })
})
