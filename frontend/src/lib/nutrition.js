// Metabolic rate calculations — Mifflin-St Jeor (1990).
//
// Activity level reflects daily lifestyle EXCLUDING structured training sessions.
// workoutsPerWeek captures those sessions separately and adds their caloric
// contribution on top, avoiding the double-counting common in TDEE calculators
// that fold exercise into a single lifestyle multiplier.

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'extra']

// Lifestyle-only NEAT multipliers (no structured training included).
export const ACTIVITY_MULT = {
  sedentary: 1.2,
  light:     1.35,
  moderate:  1.5,
  active:    1.65,
  extra:     1.8,
}

export const ACTIVITY_LABEL = {
  sedentary: 'Sedentary',
  light:     'Lightly active',
  moderate:  'Moderately active',
  active:    'Very active',
  extra:     'Extremely active',
}

// Descriptions clarify that gym sessions are NOT counted in the level choice.
export const ACTIVITY_DESC = {
  sedentary: 'Desk job, minimal movement outside training',
  light:     'Some walking or light daily activity outside training',
  moderate:  'Active lifestyle or light physical job, outside training',
  active:    'Physical job or very active daily life outside training',
  extra:     'Manual labour — extremely active outside training',
}

// Each structured session burns roughly 10 % of daily BMR on average.
// Spread over 7 days: 0.1 / 7 ≈ 0.0143 per session per day.
const PER_WORKOUT_DAILY = 0.1 / 7

// Mifflin-St Jeor (1990).
// Men:   BMR = 10 × w + 6.25 × h − 5 × a + 5
// Women: BMR = 10 × w + 6.25 × h − 5 × a − 161
// w = kg, h = cm, a = years. Returns null for any missing or invalid input.
export function calcBMR(sex, weightKg, heightCm, age) {
  if (weightKg == null || heightCm == null || age == null) return null
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'female' ? base - 161 : base + 5)
}

// TDEE = BMR × lifestyle multiplier + per-session workout contribution.
// Returns null when bmr is null.
export function calcTDEE(bmr, activityLevel, workoutsPerWeek) {
  if (bmr == null) return null
  const mult = ACTIVITY_MULT[activityLevel] ?? ACTIVITY_MULT.sedentary
  const workoutBonus = bmr * PER_WORKOUT_DAILY * (workoutsPerWeek || 0)
  return Math.round(bmr * mult + workoutBonus)
}
