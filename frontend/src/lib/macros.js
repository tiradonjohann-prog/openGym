// Macro targets based on recognized references:
//   Protein  — EFSA NDA 2012 (0.83 g/kg sedentary) and ANSES 2021 (1.6 g/kg active, ≥3 sessions/week)
//   Fat      — ANSES 2019 "Actualisation des repères du PNNS": 35–40% of total kcal
//   Carbs    — Remainder after protein and fat kcal are allocated
//   Fiber    — ANSES 2017 nutritional reference: 25 g/day for adults
//
// These are population-level reference values, not individual prescriptions.

const PROT_SEDENTARY = 0.83   // g/kg — EFSA NDA 2012
const PROT_ACTIVE    = 1.6    // g/kg — ANSES 2021 (≥3 sessions/week)
const PROT_RECOMP    = 2.0    // g/kg — sports science consensus for recomp/bulk

const FAT_PCT        = 0.35   // 35% of kcal — ANSES 2019 lower bound
const FIBER_G        = 25     // g/day — ANSES 2017

const KCAL_PER_PROT  = 4
const KCAL_PER_CARB  = 4
const KCAL_PER_FAT   = 9

export const MACRO_SOURCE = 'ANSES 2019 / EFSA NDA 2012'

function protMultiplier(goal, workoutsPerWeek) {
  if (goal === 'recomp' || goal === 'bulk') return PROT_RECOMP
  if ((workoutsPerWeek || 0) >= 3) return PROT_ACTIVE
  return PROT_SEDENTARY
}

export function calcMacros(targetKcal, weightKg, goal, workoutsPerWeek) {
  if (!targetKcal || !weightKg) return null

  const protKg   = protMultiplier(goal, workoutsPerWeek)
  const protG    = Math.round(protKg * weightKg)
  const protKcal = protG * KCAL_PER_PROT

  const fatKcal  = Math.round(targetKcal * FAT_PCT)
  const fatG     = Math.round(fatKcal / KCAL_PER_FAT)

  const carbsKcal = Math.max(0, targetKcal - protKcal - fatKcal)
  const carbsG    = Math.round(carbsKcal / KCAL_PER_CARB)

  return { protG, carbsG, fatG, fiberG: FIBER_G }
}

export function macroKcal(macros) {
  if (!macros) return 0
  return (macros.protG || 0) * KCAL_PER_PROT
       + (macros.carbsG || 0) * KCAL_PER_CARB
       + (macros.fatG || 0) * KCAL_PER_FAT
}
