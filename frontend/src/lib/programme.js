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

export function workoutForProgSession(workouts, programmeId, weekNum, sessionIdx) {
  return workouts.find(w =>
    w.programmeId === programmeId && w.progWeek === weekNum && w.progSessionIdx === sessionIdx
  ) || null
}

export function rewindProgrammeForDeletedWorkout(prog, progWeek, progSessionIdx) {
  if (!prog || progWeek == null || progSessionIdx == null) return false
  const key = String(progWeek)
  if (!prog.weekProgress || !prog.weekProgress[key] || !prog.weekProgress[key][progSessionIdx]) return false
  prog.weekProgress[key][progSessionIdx] = false
  if (prog.currentWeek > progWeek) prog.currentWeek = progWeek
  return true
}

// Re-adds a routine to the programme's weekly rotation (e.g. after the user
// removes then reconsiders, or wants a routine twice a week). Weeks that were
// already fully completed before this call are backfilled so the new slot
// doesn't retroactively reopen them — only the current and future weeks show
// it as a pending session.
export function addRoutineToProgramme(prog, routineId) {
  const wasCompleteByWeek = {}
  for (let w = 1; w <= prog.totalWeeks; w++) wasCompleteByWeek[w] = isWeekComplete(prog, w)

  prog.routineIds = [...prog.routineIds, routineId]
  const newIndex = prog.routineIds.length - 1

  prog.weekProgress = prog.weekProgress || {}
  for (let w = 1; w <= prog.totalWeeks; w++) {
    if (!wasCompleteByWeek[w]) continue
    const key = String(w)
    const done = prog.weekProgress[key] ? [...prog.weekProgress[key]] : []
    done[newIndex] = true
    prog.weekProgress[key] = done
  }
}

export function activeProgramme(S) {
  const list = S.programmes || []
  return list.find(p => !p.paused && !isProgrammeComplete(p)) || null
}

export function nextSession(prog, routines) {
  if (!prog || prog.paused || isProgrammeComplete(prog)) return null
  // Search from week 1 rather than trusting prog.currentWeek: currentWeek can
  // go stale (past totalWeeks, or an editing operation can leave an earlier
  // week newly incomplete). A week before currentWeek with no *recorded*
  // progress is trusted as already completed — currentWeek only advances
  // past a finished week — so it's skipped; a week with recorded-but-
  // incomplete progress is not, which is what catches the stale case without
  // reopening every untouched earlier week.
  for (let week = 1; week <= prog.totalWeeks; week++) {
    if (week < prog.currentWeek && !prog.weekProgress?.[String(week)]) continue
    const sessionIdx = nextSessionIdx(prog, week)
    if (sessionIdx === -1) continue
    const routineId = prog.routineIds[sessionIdx]
    return {
      routineId,
      weekNum: week,
      sessionIdx,
      routine: routines.find(r => r.id === routineId) || null,
    }
  }
  return null
}
