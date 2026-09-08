// Body measurement helpers — pure reads/writes over S.measurements.
// Each entry: { d: ISO, values: { chest?, waist?, hips?, arm?, thigh?, calf? } }
// All values in cm. 6 tracked zones.

export const MEASURE_FIELDS = [
  { key: 'chest', label: 'Chest', name: 'Poitrine' },
  { key: 'waist', label: 'Waist', name: 'Tour de taille' },
  { key: 'hips',  label: 'Hips',  name: 'Hanches' },
  { key: 'arm',   label: 'Arm',   name: 'Bras' },
  { key: 'thigh', label: 'Thigh', name: 'Cuisse' },
  { key: 'calf',  label: 'Calf',  name: 'Mollet' },
]

// Color per zone (matches BodyMeasureMap)
export const MEASURE_COLORS = {
  chest: 'var(--acc)',
  waist: 'var(--blue)',
  hips:  'var(--green)',
  arm:   'var(--orange)',
  thigh: 'var(--purple)',
  calf:  'var(--teal)',
}

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

// Delta from previous to last entry. Returns null if < 2 entries.
export function measureDelta(S, key) {
  const series = measureSeries(S, key)
  if (series.length < 2) return null
  return Math.round((series[series.length - 1].y - series[series.length - 2].y) * 10) / 10
}
