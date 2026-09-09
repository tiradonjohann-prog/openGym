// In-app reminder logic for body weight and measurements.
// Returns true when a reminder should surface as a banner on Home.

function pastConfiguredTime(hour, minute) {
  const now = new Date()
  return now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute)
}

export function bwReminderDue(S) {
  const r = S.reminderBW
  if (!r?.on) return false
  if (!pastConfiguredTime(r.hour ?? 7, r.minute ?? 0)) return false
  const bw = S.bodyweight || []
  if (!bw.length) return true
  const last = bw[bw.length - 1]
  const daysSince = (Date.now() - new Date(last.d).getTime()) / 86400000
  return daysSince >= (r.every ?? 1)
}

export function measReminderDue(S) {
  const r = S.reminderMeas
  if (!r?.on) return false
  if (!pastConfiguredTime(r.hour ?? 8, r.minute ?? 0)) return false
  const meas = S.measurements || []
  if (!meas.length) return true
  const last = meas[meas.length - 1]
  const daysSince = (Date.now() - new Date(last.d).getTime()) / 86400000
  return daysSince >= (r.every ?? 14)
}
