// Pure programme progression helpers — no store imports, no side effects.
// A "programme" groups ordered routines into a multi-week training arc.
// weekProgress shape: { "1": [true, false, true], "2": [...] }
// Index = session position in routineIds array.

export function sessionStates(prog, weekNum) {
  const key = String(weekNum)
  const done = (prog.weekProgress && prog.weekProgress[key]) || []
  const n = prog.routineIds.length
  let foundNext = false
  return Array.from({ length: n }, (_, i) => {
    if (done[i]) return 'done'
    if (!foundNext) { foundNext = true; return 'next' }
    return 'upcoming'
  })
}

export function isWeekComplete(prog, weekNum) {
  const key = String(weekNum)
  const done = (prog.weekProgress && prog.weekProgress[key]) || []
  return prog.routineIds.every((_, i) => !!done[i])
}

export function isProgrammeComplete(prog) {
  if (!prog.totalWeeks || prog.totalWeeks <= 0) return false
  for (let w = 1; w <= prog.totalWeeks; w++) {
    if (!isWeekComplete(prog, w)) return false
  }
  return true
}

export function completedWeekCount(prog) {
  if (!prog.totalWeeks) return 0
  let n = 0
  for (let w = 1; w <= prog.totalWeeks; w++) {
    if (isWeekComplete(prog, w)) n++
  }
  return n
}

export function nextSessionIdx(prog, weekNum) {
  const states = sessionStates(prog, weekNum)
  return states.indexOf('next')
}
