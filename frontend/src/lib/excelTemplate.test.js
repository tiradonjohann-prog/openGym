// frontend/src/lib/excelTemplate.test.js
import { describe, it, expect } from 'vitest'
import { EXDB } from './exercises.js'

// The Excel template's example rows must reference real exercise names, or the
// generated dropdown (built from BODY_PARTS/EXDB) will show a broken example.
// This test lives here rather than importing excelTemplate.js directly because
// that module dynamically imports 'exceljs' and targets a browser download flow.
describe('excelTemplate example data availability', () => {
  it('has at least 3 CHEST exercises to use as examples', () => {
    expect(EXDB.filter(e => e.bp === 'CHEST').length).toBeGreaterThanOrEqual(3)
  })
  it('has at least 2 LEGS exercises to use as examples', () => {
    expect(EXDB.filter(e => e.bp === 'LEGS').length).toBeGreaterThanOrEqual(2)
  })

  // Exact example names used in excelTemplate.js's `examples` array — verifies
  // every ex:/bp: pair in the generated template's sample rows is a real,
  // existing catalog entry under the expected body part.
  const usedExamples = [
    { bp: 'CHEST', ex: 'Barbell Bench Press' },
    { bp: 'SHOULDERS', ex: 'Barbell Overhead Press' },
    { bp: 'TRICEPS', ex: 'Cable Triceps Pushdown' },
    { bp: 'BACK', ex: 'Pull-Up' },
    { bp: 'LEGS', ex: 'Barbell Squat' },
    { bp: 'LEGS', ex: 'Dumbbell Romanian Deadlift' },
    { bp: 'LEGS', ex: 'Standing Calf Raise' },
    { bp: 'ABS', ex: 'Plank' },
  ]

  it.each(usedExamples)('example exercise "$ex" exists under body part $bp', ({ bp, ex }) => {
    const found = EXDB.find(e => e.n === ex && e.bp === bp)
    expect(found).toBeDefined()
  })
})
