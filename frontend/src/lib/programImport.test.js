import { describe, it, expect } from 'vitest'
import { parseProgramCSV, findExercise } from './programImport.js'

// Minimal fake exercise database for testing — avoids the full EXDB import
const MOCK_DB = [
  { id: 'ex01', n: 'Barbell Bench Press', bp: 'chest',      eq: 'barbell' },
  { id: 'ex02', n: 'Barbell Overhead Press', bp: 'shoulders', eq: 'barbell' },
  { id: 'ex03', n: 'Triceps Pushdown',     bp: 'upper arms', eq: 'cable'   },
  { id: 'ex04', n: 'Pull-up',              bp: 'back',       eq: 'bodyweight' },
  { id: 'ex05', n: 'Barbell Back Squat',   bp: 'upper legs', eq: 'barbell' },
]

// Build a CSV string from header + rows (mirrors the Excel template column order)
const makeCSV = rows =>
  [
    'Programme,Séance,N° Séance,N° Exercice,Groupe Musculaire,Exercice,Tempo,Séries,Poids (kg),Repos (sec)',
    ...rows,
  ].join('\n')

describe('parseProgramCSV — column detection', () => {
  it('reads exercise names from the Exercice column (col F), not N° Exercice (col D)', () => {
    const csv = makeCSV([
      'PPL,Push,1,1,chest,Barbell Bench Press,4010,4,,90',
    ])
    const { routines, warnings } = parseProgramCSV(csv, MOCK_DB)
    expect(warnings).toHaveLength(0)
    expect(routines[0].ex[0].id).toBe('ex01')
  })

  it('does not treat the exercise number "2A" as an exercise name', () => {
    const csv = makeCSV([
      'PPL,Push,1,2A,shoulders,Barbell Overhead Press,,3,,0',
      'PPL,Push,1,2B,upper arms,Triceps Pushdown,,3,,60',
    ])
    const { routines, warnings } = parseProgramCSV(csv, MOCK_DB)
    // No "Exercise not found: 2A" warnings
    expect(warnings.filter(w => w.includes('2A') || w.includes('2B'))).toHaveLength(0)
    expect(routines[0].ex).toHaveLength(2)
    expect(routines[0].ex[0].id).toBe('ex02')
    expect(routines[0].ex[1].id).toBe('ex03')
  })

  it('assigns the same sg id to exercises sharing a superset number', () => {
    const csv = makeCSV([
      'PPL,Push,1,2A,shoulders,Barbell Overhead Press,,3,,0',
      'PPL,Push,1,2B,upper arms,Triceps Pushdown,,3,,60',
    ])
    const { routines } = parseProgramCSV(csv, MOCK_DB)
    const [a, b] = routines[0].ex
    expect(a.sg).toBeTruthy()
    expect(a.sg).toBe(b.sg)
  })

  it('does not assign sg to normal (non-letter) exercise numbers', () => {
    const csv = makeCSV([
      'PPL,Push,1,1,chest,Barbell Bench Press,4010,4,,90',
      'PPL,Push,1,2,back,Pull-up,3010,4,,90',
    ])
    const { routines } = parseProgramCSV(csv, MOCK_DB)
    expect(routines[0].ex[0].sg).toBeUndefined()
    expect(routines[0].ex[1].sg).toBeUndefined()
  })

  it('creates separate routines for separate sessions', () => {
    const csv = makeCSV([
      'PPL,Push,1,1,chest,Barbell Bench Press,,4,,90',
      'PPL,Lower,2,1,upper legs,Barbell Back Squat,,4,,120',
    ])
    const { programName, routines } = parseProgramCSV(csv, MOCK_DB)
    expect(programName).toBe('PPL')
    expect(routines).toHaveLength(2)
    expect(routines[0].name).toBe('Push')
    expect(routines[1].name).toBe('Lower')
  })
})

describe('findExercise — fuzzy matching', () => {
  it('finds an exact match', () => {
    expect(findExercise('Pull-up', MOCK_DB)?.id).toBe('ex04')
  })

  it('returns null for a junk string like "2A"', () => {
    expect(findExercise('2A', MOCK_DB)).toBeNull()
  })

  it('finds via word overlap (ignores barbell stopword)', () => {
    expect(findExercise('Bench Press', MOCK_DB)?.id).toBe('ex01')
  })
})
