// Personal-record detection — pure reads over S.workouts.
//
// Three PR tiers, in descending order of prestige:
//   'weight'   — heaviest load ever lifted (any rep count)
//   'reprange' — heaviest load for this specific rep count (best 5RM, 10RM …)
//   'e1rm'     — new best estimated 1-rep max (may come from lighter weight at more reps)
//
// Everything is derived from history on demand — nothing is stored in DEF.
// This guarantees the records can never drift out of sync with the log.

import { estimate1RM, e1rmSeries } from './onerm.js'

// Best weight ever at each completed rep count for one exercise.
// Returns { [reps: number]: weight } — keys are rounded rep counts.
export function bestByReps(S, exId) {
  const map = {}
  ;(S.workouts || []).forEach(w => {
    const entry = w.entries.find(e => e.id === exId)
    if (!entry) return
    entry.sets.forEach(s => {
      if (!s.done || !(s.w > 0) || !(s.r > 0)) return
      const r = Math.round(s.r)
      if (!map[r] || s.w > map[r]) map[r] = s.w
    })
  })
  return map
}

// Pre-compute all historical bests for one exercise in a single O(n) pass.
// Pass the result to prKindOf to avoid repeated scans when checking many sets.
export function historicalBests(S, exId) {
  let weight = 0
  const byReps = {}
  ;(S.workouts || []).forEach(w => {
    const entry = w.entries.find(e => e.id === exId)
    if (!entry) return
    entry.sets.forEach(s => {
      if (!s.done) return
      if (s.w > weight) weight = s.w
      if (s.w > 0 && s.r > 0) {
        const r = Math.round(s.r)
        if (!byReps[r] || s.w > byReps[r]) byReps[r] = s.w
      }
    })
  })
  const series = e1rmSeries(S, exId)
  const e1rm = series.length ? Math.max(...series.map(p => p.y)) : 0
  return { weight, byReps, e1rm }
}

// What kind of PR is this set? Returns 'weight' | 'reprange' | 'e1rm' | null.
// Pass `bests` from historicalBests() so the caller pays the scan cost once.
export function prKindOf(bests, weight, reps) {
  if (!(weight > 0) || !(reps > 0)) return null
  const r = Math.round(reps)
  if (weight > (bests.weight || 0)) return 'weight'
  if (!bests.byReps[r] || weight > bests.byReps[r]) return 'reprange'
  const est = estimate1RM(weight, reps)
  if (est !== null && est > (bests.e1rm || 0)) return 'e1rm'
  return null
}

// All-time best performance per exercise, for the Records board.
// Returns array sorted by most recent PR date, newest first.
export function allTimePRs(S) {
  const exIds = [...new Set((S.workouts || []).flatMap(w => w.entries.map(e => e.id)))]
  const result = []

  exIds.forEach(exId => {
    let weight = 0, weightDate = null
    let e1rm = 0, e1rmDate = null

    ;(S.workouts || []).forEach(w => {
      const entry = w.entries.find(e => e.id === exId)
      if (!entry) return
      entry.sets.forEach(s => {
        if (!s.done) return
        if (s.w > weight) { weight = s.w; weightDate = w.d }
        const est = estimate1RM(s.w, s.r)
        if (est !== null && est > e1rm) { e1rm = est; e1rmDate = w.d }
      })
    })

    if (weight <= 0 && e1rm <= 0) return
    result.push({ exId, weight, weightDate, e1rm, e1rmDate })
  })

  result.sort((a, b) => {
    const da = [a.weightDate, a.e1rmDate].filter(Boolean).sort().pop() || ''
    const db = [b.weightDate, b.e1rmDate].filter(Boolean).sort().pop() || ''
    return db.localeCompare(da)
  })

  return result
}
