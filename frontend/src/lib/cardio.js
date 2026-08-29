// Cardio calorie formulas based on Ainsworth et al. 2011
// "Compendium of Physical Activities" — the standard reference in exercise science.
// Formula: kcal = MET × weightKg × durationHours
//
// MET values vary with intensity (speed/pace for run and bike).
// All kcal calculations can be overridden by manual user entry.

export const CARDIO_TYPES = {
  run:  { label: 'Running',  icon: 'figureRun', fields: ['duration', 'distance', 'elevation'] },
  walk: { label: 'Walking',  icon: 'person',    fields: ['duration', 'distance', 'elevation'] },
  bike: { label: 'Cycling',  icon: 'bike',      fields: ['duration', 'distance', 'elevation'] },
  swim: { label: 'Swimming', icon: 'swim',      fields: ['duration', 'distance'] },
  aqua: { label: 'Aquagym',  icon: 'bolt',      fields: ['duration'] },
}

// MET for running scales with speed (Ainsworth 2011, codes 02000-02050)
function metRun(speedKph) {
  if (speedKph < 6)  return 5.0
  if (speedKph < 8)  return 7.0
  if (speedKph < 10) return 8.5
  if (speedKph < 12) return 10.0
  if (speedKph < 14) return 11.5
  return 13.5
}

// MET for cycling scales with speed (Ainsworth 2011, codes 01010-01060)
function metBike(speedKph) {
  if (speedKph < 15) return 5.0
  if (speedKph < 20) return 7.0
  if (speedKph < 25) return 10.0
  return 12.0
}

// Fixed MET values for other activities (Ainsworth 2011)
const MET_WALK = 3.5
const MET_SWIM = 7.0
const MET_AQUA = 4.5

function getMET(type, durationMin, distKm) {
  const speed = durationMin && distKm ? distKm / (durationMin / 60) : null
  if (type === 'run')  return speed ? metRun(speed)  : 8.5
  if (type === 'bike') return speed ? metBike(speed) : 6.0
  if (type === 'walk') return MET_WALK
  if (type === 'swim') return MET_SWIM
  if (type === 'aqua') return MET_AQUA
  return null
}

export function calcCardioKcal(type, weightKg, durationMin, distKm) {
  if (!weightKg || !durationMin) return null
  const met = getMET(type, durationMin, distKm)
  if (met == null) return null
  return Math.round(met * weightKg * (durationMin / 60))
}

// Returns speed in km/h (1 decimal), or null if inputs are missing/zero
export function calcPace(durationMin, distKm) {
  if (!durationMin || !distKm || distKm === 0) return null
  return Math.round((distKm / (durationMin / 60)) * 10) / 10
}

// Sum of all cardio kcal logged on a given date
export function dayCardioKcal(log, date) {
  return (log?.[date]?.sport || []).reduce((sum, s) => sum + (s.kcal || 0), 0)
}
