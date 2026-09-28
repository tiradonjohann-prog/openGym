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

// Same, but with a Répétitions column (for reps-value tests) and a trailing
// Type Exercice column (reps/time) — mirrors the template once that column is
// appended at the end, after Repos (sec). Named "Type Exercice" rather than
// bare "Type": colOf's partial-match fallback would otherwise let a bare
// "Type" header collide with the existing cardio "Type Cardio"/"Type Bloc"
// column-detection keywords (a real bug hit while writing this).
const makeCSVWithType = rows =>
  [
    'Programme,Séance,N° Séance,N° Exercice,Groupe Musculaire,Exercice,Tempo,Séries,Répétitions,Poids (kg),Repos (sec),Type Exercice',
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

describe('parseProgramCSV — Semaines column', () => {
  const makeCSVWithWeeks = rows =>
    [
      'Programme,Séance,N° Séance,N° Exercice,Groupe Musculaire,Exercice,Tempo,Séries,Poids (kg),Repos (sec),Semaines',
      ...rows,
    ].join('\n')

  it('reads the program duration from the Semaines column', () => {
    const csv = makeCSVWithWeeks([
      'PPL,Push,1,1,chest,Barbell Bench Press,,4,,90,8',
    ])
    const { totalWeeks } = parseProgramCSV(csv, MOCK_DB)
    expect(totalWeeks).toBe(8)
  })

  it('defaults to 1 week when the column is absent or blank', () => {
    const csv = makeCSV([
      'PPL,Push,1,1,chest,Barbell Bench Press,4010,4,,90',
    ])
    const { totalWeeks } = parseProgramCSV(csv, MOCK_DB)
    expect(totalWeeks).toBe(1)
  })

  it('only needs the value filled once — any row — for the whole program', () => {
    const csv = makeCSVWithWeeks([
      'PPL,Push,1,1,chest,Barbell Bench Press,,4,,90,',
      'PPL,Push,1,2,back,Pull-up,,4,,90,12',
    ])
    const { totalWeeks } = parseProgramCSV(csv, MOCK_DB)
    expect(totalWeeks).toBe(12)
  })
})

describe('parseProgramCSV — image URL column detection', () => {
  it('does not mistake the Programme column for an image URL column', () => {
    // No dedicated image column in this header — imageUrlCol must stay
    // unresolved rather than colliding with column 0 (Programme) via
    // colOf's partial-match fallback (the keyword "image programme"
    // contains "programme" as a substring — a real bug hit in production:
    // every import silently set the programme's cover imageUrl to its own
    // name string).
    const csv = makeCSV([
      'Programme Maman,Push,1,1,chest,Barbell Bench Press,,4,,90',
    ])
    const { programImageUrl } = parseProgramCSV(csv, MOCK_DB)
    expect(programImageUrl).toBeNull()
  })
})

describe('parseProgramCSV — Type column (reps vs time)', () => {
  it('defaults to mode "reps" and reads the Répétitions column as reps when Type is blank', () => {
    const csv = makeCSVWithType([
      'PPL,Push,1,1,chest,Barbell Bench Press,,4,8,,90,',
    ])
    const { routines } = parseProgramCSV(csv, MOCK_DB)
    const entry = routines[0].ex[0]
    expect(entry.mode).toBe('reps')
    expect(entry.reps).toBe(8)
    expect(entry.sec).toBeUndefined()
  })

  it('sets mode "time" and reads the Répétitions column as seconds when Type is "temps"', () => {
    const csv = makeCSVWithType([
      'PPL,Push,1,1,back,Pull-up,,3,45,,60,temps',
    ])
    const { routines } = parseProgramCSV(csv, MOCK_DB)
    const entry = routines[0].ex[0]
    expect(entry.mode).toBe('time')
    expect(entry.sec).toBe(45)
    expect(entry.reps).toBeUndefined()
  })

  it('also accepts the English "time" value', () => {
    const csv = makeCSVWithType([
      'PPL,Push,1,1,back,Pull-up,,3,30,,60,time',
    ])
    const { routines } = parseProgramCSV(csv, MOCK_DB)
    expect(routines[0].ex[0].mode).toBe('time')
    expect(routines[0].ex[0].sec).toBe(30)
  })

  it('falls back to a 45s default when Type is "temps" but the value cell is blank', () => {
    const csv = makeCSVWithType([
      'PPL,Push,1,1,back,Pull-up,,3,,,60,temps',
    ])
    const { routines } = parseProgramCSV(csv, MOCK_DB)
    expect(routines[0].ex[0].mode).toBe('time')
    expect(routines[0].ex[0].sec).toBe(45)
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
