// Body measurement helpers — pure reads/writes over S.measurements.
// Each entry: { d: ISO, values: { chest?, waist?, hip?, arm?, thigh?, calf?, shoulder?, neck? } }
// All values in cm.

export const MEASURE_FIELDS = [
  { key: 'chest',    icon: 'heart',     label: 'Chest' },
  { key: 'waist',    icon: 'circle',    label: 'Waist' },
  { key: 'hip',      icon: 'oval',      label: 'Hips' },
  { key: 'arm',      icon: 'dumbbell',  label: 'Arm' },
  { key: 'thigh',    icon: 'figure',    label: 'Thigh' },
  { key: 'calf',     icon: 'figure',    label: 'Calf' },
  { key: 'shoulder', icon: 'person',    label: 'Shoulder' },
  { key: 'neck',     icon: 'person',    label: 'Neck' },
]

// Most recent entry for each measurement field.
export function latestMeasurements(S) {
  const result = {}
  ;(S.measurements || []).forEach(entry => {
    Object.entries(entry.values || {}).forEach(([k, v]) => {
      if (v > 0) result[k] = { v, d: entry.d }
    })
  })
  return result
}

// Historical series for one field: [{ t, y, d }]
export function measureSeries(S, key) {
  return (S.measurements || [])
    .filter(e => (e.values || {})[key] > 0)
    .map(e => ({ t: new Date(e.d).getTime(), y: e.values[key], d: e.d }))
    .sort((a, b) => a.t - b.t)
}

// Delta from first to last entry for a field. Returns null if < 2 entries.
export function measureDelta(S, key) {
  const series = measureSeries(S, key)
  if (series.length < 2) return null
  return Math.round((series[series.length - 1].y - series[0].y) * 10) / 10
}
