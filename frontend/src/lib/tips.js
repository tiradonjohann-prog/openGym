// Contextual nutrition tips.
// Tips are factual, brief (< 100 chars message), and never judgmental.
// Scientific basis: ANSES 2019/2021, EFSA NDA 2012, general sports nutrition literature.

export const SEVERITY = { soft: 'soft', info: 'info', ok: 'ok' }

function hourNow() { return new Date().getHours() }

function mealsKcal(log, date) {
  return (log?.[date]?.meals || [])
    .reduce((s, m) => s + m.items.reduce((si, i) => si + (i.kcal || 0), 0), 0)
}

function mealsProt(log, date) {
  return (log?.[date]?.meals || [])
    .reduce((s, m) => s + m.items.reduce((si, i) => si + (i.prot || 0), 0), 0)
}

function mealsFiber(log, date) {
  return (log?.[date]?.meals || [])
    .reduce((s, m) => s + m.items.reduce((si, i) => si + (i.fiber || 0), 0), 0)
}

function hasLoggedToday(log, date) {
  return (log?.[date]?.meals || []).some(m => m.items.length > 0)
}

function logsLastNDays(log, today, n) {
  let count = 0
  for (let i = 0; i < n; i++) {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    if (hasLoggedToday(log, iso)) count++
  }
  return count
}

export const TIPS = [
  {
    id: 'profile_incomplete',
    condition: ({ nutrition }) => !nutrition?.bmr,
    message: 'Complete your profile (age, height, weight) to unlock calorie and macro targets.',
    severity: SEVERITY.info,
  },
  {
    id: 'no_weight_logged',
    condition: ({ weightKg }) => !weightKg,
    message: 'Log a body weight in the main app to enable BMR and macro calculations.',
    severity: SEVERITY.info,
  },
  {
    id: 'no_log_today',
    condition: ({ log, today }) =>
      hourNow() >= 12 && !hasLoggedToday(log, today),
    message: 'No meals logged today. Regular tracking gives more accurate weekly averages.',
    severity: SEVERITY.info,
  },
  {
    id: 'protein_low_evening',
    condition: ({ macros, log, today }) =>
      hourNow() >= 17 && macros?.protG && mealsProt(log, today) < macros.protG * 0.6,
    message: 'Under 60% of your protein target. Eggs, dairy, legumes or meat at dinner can help.',
    severity: SEVERITY.soft,
  },
  {
    id: 'fiber_low_evening',
    condition: ({ macros, log, today }) =>
      hourNow() >= 20 && mealsFiber(log, today) < 10,
    message: 'Very low fiber today. Vegetables, legumes and whole grains support gut health.',
    severity: SEVERITY.info,
  },
  {
    id: 'aggressive_deficit',
    condition: ({ nutrition }) => {
      const { tdee, targetKcal } = nutrition || {}
      if (!tdee || !targetKcal) return false
      return (tdee - targetKcal) / tdee > 0.20
    },
    message: 'Deficit > 20% of TDEE. ANSES recommends ≤ 500 kcal/day to preserve muscle.',
    severity: SEVERITY.soft,
  },
  {
    id: 'bulk_low_workouts',
    condition: ({ nutrition }) =>
      nutrition?.goal === 'bulk' && (nutrition?.workoutsPerWeek || 0) < 2,
    message: 'A surplus without resistance training tends to produce fat, not muscle.',
    severity: SEVERITY.soft,
  },
  {
    id: 'recomp_tip',
    condition: ({ nutrition }) => nutrition?.goal === 'recomp',
    message: 'Recomposition takes months. High protein and progressive training are the key levers.',
    severity: SEVERITY.info,
  },
  {
    id: 'kcal_on_target',
    condition: ({ nutrition, log, today }) => {
      const target = nutrition?.targetKcal
      if (!target) return false
      const ate = mealsKcal(log, today)
      return ate > target * 0.90 && ate <= target * 1.05
    },
    message: 'Calorie intake is right on target today.',
    severity: SEVERITY.ok,
  },
  {
    id: 'good_week',
    condition: ({ log, today }) => logsLastNDays(log, today, 7) >= 6,
    message: 'You\'ve logged meals 6+ days this week — consistent tracking drives results.',
    severity: SEVERITY.ok,
  },
  {
    id: 'sporadic_logging',
    condition: ({ log, today }) => {
      const n = logsLastNDays(log, today, 7)
      return n > 0 && n <= 2
    },
    message: 'You\'ve only logged a couple of days this week. Weekly averages are more reliable with daily logs.',
    severity: SEVERITY.info,
  },
]

export function getActiveTips(context, dismissed = []) {
  return TIPS.filter(t => !dismissed.includes(t.id) && t.condition(context))
}
