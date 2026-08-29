// Goal-based calorie targets.
// Reference: ANSES 2019 "Actualisation des repères du PNNS" — safe deficit ≤ 500 kcal/day.

export const GOALS = ['maintain', 'cut', 'bulk', 'recomp']

export const GOAL_LABEL = {
  maintain: 'Maintain weight',
  cut: 'Lose weight',
  bulk: 'Gain muscle',
  recomp: 'Body recomposition',
}

export const GOAL_DESC = {
  maintain: 'Match calorie intake to your TDEE to stay at your current weight.',
  cut: 'A moderate deficit helps lose body fat while preserving muscle.',
  bulk: 'A moderate surplus supports muscle growth with minimal fat gain.',
  recomp: 'Close to maintenance calories with high protein — lose fat and gain muscle over time.',
}

// Default kcal offset per goal (ANSES: safe deficit ≤ 500 kcal/day)
export const GOAL_DEFAULT_DELTA = {
  maintain: 0,
  cut: -300,
  bulk: 300,
  recomp: 0,
}

export const DELTA_MIN = -500
export const DELTA_MAX = 600

export function calcTargetKcal(tdee, delta) {
  if (tdee == null) return null
  return Math.round(tdee + (delta || 0))
}

// Returns true when the delta exceeds 20% of TDEE — signals an aggressive approach
export function isAggressiveDelta(tdee, delta) {
  if (!tdee || !delta) return false
  return Math.abs(delta) / tdee > 0.20
}
