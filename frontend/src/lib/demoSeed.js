// The example profile behind the demo build (see demo.js). Imported dynamically, so it stays
// out of the bundle self-hosters ship.
import { isoOf, uid } from './format.js'
import { starterRoutines } from './starter.js'
import { modeOf } from './history.js'

// ─── Nutrition seed helpers ───────────────────────────────────────────────────

// Per-100g nutritional data for common foods used in the demo log.
const F = {
  oats:     { n: 'Flocons d\'avoine',     k: 370, p: 13,  c: 60,  f: 6.5, fi: 11 },
  yogurt:   { n: 'Yaourt grec 0%',         k: 59,  p: 10,  c: 4,   f: 0,   fi: 0 },
  banana:   { n: 'Banane',                 k: 89,  p: 1,   c: 23,  f: 0.2, fi: 3 },
  chicken:  { n: 'Blanc de poulet grillé', k: 165, p: 31,  c: 0,   f: 4,   fi: 0 },
  rice:     { n: 'Riz complet cuit',       k: 130, p: 3,   c: 26,  f: 1,   fi: 2 },
  broccoli: { n: 'Brocoli vapeur',         k: 34,  p: 2.8, c: 6,   f: 0.4, fi: 2.6 },
  cottage:  { n: 'Fromage blanc 0%',       k: 61,  p: 11,  c: 4,   f: 0,   fi: 0 },
  almonds:  { n: 'Amandes',                k: 580, p: 21,  c: 13,  f: 50,  fi: 12 },
  salmon:   { n: 'Saumon',                 k: 208, p: 23,  c: 0,   f: 13,  fi: 0 },
  turkey:   { n: 'Dinde hachée',           k: 130, p: 20,  c: 0,   f: 5,   fi: 0 },
  swPotato: { n: 'Patate douce',           k: 86,  p: 1.5, c: 20,  f: 0.1, fi: 3 },
  spinach:  { n: 'Épinards',               k: 23,  p: 3,   c: 2,   f: 0.4, fi: 2 },
  quinoa:   { n: 'Quinoa cuit',            k: 120, p: 4.5, c: 22,  f: 2,   fi: 3 },
  tuna:     { n: 'Thon (conserve)',         k: 116, p: 25,  c: 0,   f: 1,   fi: 0 },
  pasta:    { n: 'Pâtes complètes cuites', k: 160, p: 6,   c: 31,  f: 1,   fi: 3 },
  carrots:  { n: 'Carottes',               k: 41,  p: 0.9, c: 10,  f: 0.2, fi: 2.8 },
  egg:      { n: 'Œufs entiers',           k: 155, p: 13,  c: 1,   f: 11,  fi: 0 },
  beef:     { n: 'Steak haché 5% MG',      k: 145, p: 20,  c: 0,   f: 7,   fi: 0 },
  lentils:  { n: 'Lentilles cuites',       k: 116, p: 9,   c: 20,  f: 0.4, fi: 8 },
}

function fi(food, qty) {
  const r = qty / 100
  const item = {
    id: uid(), name: food.n, qty, unit: 'g',
    kcal:  Math.round(food.k  * r),
    prot:  Math.round(food.p  * r * 10) / 10,
    carbs: Math.round(food.c  * r * 10) / 10,
    fat:   Math.round(food.f  * r * 10) / 10,
  }
  if (food.fi) item.fiber = Math.round(food.fi * r * 10) / 10
  return item
}

function slot(name, items) { return { id: uid(), name, items } }

// Meal template sets. Each template is an array of [food, qty] pairs.
const BREAKFASTS = [
  [[F.oats, 80], [F.yogurt, 150], [F.banana, 120]],        // ~530 kcal, 31p, 83g, 7f
  [[F.egg, 150], [F.oats, 60],   [F.yogurt, 100]],          // ~490 kcal, 33p, 50g, 17f
  [[F.oats, 100], [F.yogurt, 200]],                          // ~530 kcal, 33p, 68g, 7f
  [[F.egg, 100], [F.oats, 60],  [F.banana, 100]],            // ~430 kcal, 22p, 54g, 13f
  [[F.oats, 80], [F.yogurt, 200], [F.banana, 80]],           // ~540 kcal, 30p, 76g, 7f
  [[F.yogurt, 300], [F.oats, 50], [F.almonds, 15]],          // ~440 kcal, 36p, 42g, 10f
]

const LUNCHES = [
  [[F.chicken, 180], [F.rice, 200],    [F.broccoli, 150]],  // ~620 kcal, 64p, 56g, 7f
  [[F.tuna, 160],    [F.quinoa, 180],  [F.carrots, 120]],   // ~480 kcal, 47p, 45g, 3f
  [[F.chicken, 200], [F.pasta, 180],   [F.spinach, 100]],   // ~615 kcal, 66p, 58g, 10f
  [[F.turkey, 180],  [F.swPotato, 200],[F.broccoli, 100]],  // ~480 kcal, 39p, 43g, 10f
  [[F.lentils, 250], [F.chicken, 120], [F.carrots, 100]],   // ~520 kcal, 42p, 60g, 6f
  [[F.beef, 180],    [F.rice, 150],    [F.spinach, 150]],   // ~540 kcal, 40p, 44g, 16f
]

const SNACKS = [
  [[F.cottage, 200], [F.almonds, 25]],  // ~267 kcal, 26p, 11g, 13f
  [[F.yogurt, 200],  [F.almonds, 20]],  // ~234 kcal, 24p, 11g, 10f
  [[F.cottage, 250]],                   // ~153 kcal, 28p, 10g, 0f
  [[F.yogurt, 200],  [F.banana, 80]],   // ~190 kcal, 21p, 27g, 1f
]

const DINNERS = [
  [[F.salmon, 180], [F.swPotato, 200], [F.spinach, 150]],   // ~620 kcal, 45p, 43g, 24f
  [[F.beef, 200],   [F.swPotato, 180], [F.broccoli, 150]],  // ~640 kcal, 42p, 40g, 18f
  [[F.turkey, 200], [F.quinoa, 150],   [F.spinach, 200]],   // ~545 kcal, 46p, 37g, 14f
  [[F.chicken, 200],[F.rice, 150],     [F.carrots, 100]],   // ~540 kcal, 65p, 49g, 7f
  [[F.salmon, 150], [F.pasta, 150],    [F.broccoli, 200]],  // ~600 kcal, 40p, 51g, 15f
  [[F.tuna, 160],   [F.lentils, 200],  [F.spinach, 150]],   // ~450 kcal, 43p, 45g, 4f
]

// Nutrition profile for the demo user (computed at typical midpoint weight ~80kg, 178cm, 28yo, male).
// BMR ≈ 1790, light activity (1.35), 3 workouts: TDEE ≈ 2420, goal: cut −400 → target 2020.
// DEMO_NUTRI values at midpoint weight ~80kg (Mifflin-St Jeor, light + 3 workouts/week).
// BMR = 10×80 + 6.25×178 - 5×28 + 5 = 1777.5 ≈ 1778
// TDEE = 1778 × 1.35 + 1778 × (0.1/7) × 3 = 2400.3 + 76.2 = 2477
// Target = 2477 - 400 = 2077
const DEMO_NUTRI = {
  sex: 'male', age: 28, heightCm: 178,
  activityLevel: 'light',
  workoutsPerWeek: 3,
  goal: 'cut',
  goalDelta: -400,
  bmr: 1778, tdee: 2477, targetKcal: 2077,
  macros: { protG: 163, carbsG: 191, fatG: 57, fiberG: 30 },
  diet: { type: 'omnivore', mealsPerDay: 3, snacksPerDay: 1, allergens: [] },
}

function buildNutritionLog(rnd, start, today, workoutSet) {
  const log = {}
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const day = new Date(d)
    const iso = isoOf(day)
    if (rnd() < 0.08 && iso !== isoOf(today)) continue        // skip ~8% days (always log today)

    const bi = Math.floor(rnd() * BREAKFASTS.length)
    const li = Math.floor(rnd() * LUNCHES.length)
    const si = Math.floor(rnd() * SNACKS.length)
    const di = Math.floor(rnd() * DINNERS.length)

    log[iso] = {
      meals: [
        slot('Breakfast', BREAKFASTS[bi].map(([f, q]) => fi(f, q))),
        slot('Lunch',     LUNCHES[li].map(([f, q]) => fi(f, q))),
        slot('Snack',     SNACKS[si].map(([f, q]) => fi(f, q))),
        slot('Dinner',    DINNERS[di].map(([f, q]) => fi(f, q))),
      ],
      sport: [],
    }

    // Cardio on Tuesdays and Saturdays (days without strength training)
    const dow = day.getDay()
    if (!workoutSet.has(iso) && (dow === 2 || dow === 6)) {
      const isCycling = rnd() < 0.35
      const duration = 30 + Math.floor(rnd() * 25)
      const distance = isCycling
        ? Math.round((duration * 0.45 + rnd() * 3) * 10) / 10
        : Math.round((duration * 0.165 + rnd() * 1.2) * 10) / 10
      const kcal = Math.round(duration * (isCycling ? 7.5 : 9) + rnd() * 40)
      log[iso].sport.push({
        id: uid(), type: isCycling ? 'bike' : 'run',
        label: isCycling ? 'Vélo' : 'Running',
        duration, distance, kcal, manualKcal: false, date: iso,
      })
    }
  }
  return log
}

// Starting weight and weekly increment per exercise of the starter plan (kg).
// Chest dips are body-weight only here, so they log reps at 0 added weight.
const PROG = {
  '0025': [60, 1.25], '0047': [45, 1], '0426': [20, 0.5], '0334': [10, 0.25], '0241': [25, 0.75], '0251': [0, 0],
  '2330': [50, 1.25], '0027': [50, 1], '1323': [45, 1], '0031': [30, 0.5], '0313': [12, 0.3],
  '0043': [70, 1.5], '0085': [60, 1.25], '0739': [120, 3], '0585': [45, 1], '0586': [40, 1], '0605': [60, 1.5]
}
const WEEKS = 12                       // how much history to fabricate
const BW_FROM = 82.4, BW_TO = 78.3     // body-weight trend across those weeks
const TARGET_W = 77

// --- Effort -----------------------------------------------------------------------------
// The demo has to show the effort stats, not just the volume ones, so the history carries
// ratings. Flat ratings would draw a flat trend and prove nothing, so this fabricates the
// shape the charts exist to make visible: a block grinding toward failure, a deload jumping
// back off it, another block going a little deeper than the first.
const DELOAD_WEEK = 5
// Reps left in the tank the block is aiming for, by week.
const weekTarget = wk =>
  wk === DELOAD_WEEK ? 4.5
    : wk < DELOAD_WEEK ? 2.8 - wk * 0.3
      : 2.6 - (wk - DELOAD_WEEK - 1) * 0.26
// Leg day is trained further from failure than the upper body — deliberate, so the muscle
// map's "hard sets" mode shows a different picture from its all-sets mode.
const EASY = new Set(['0043', '0085', '0739', '0585', '0586'])
// One exercise nobody ever rates: partial coverage is the normal case (rating is optional and
// off by default), and it shows the per-exercise Effort toggle correctly staying away.
const NEVER_RATED = '0605'
const UNRATED = 0.1                    // …plus this share of the remaining sets, at random
// The first weeks are logged in RPE, as if they came out of another app before the profile
// switched to RIR. A set is never rewritten (see history.js), so the stats have to average a
// mixed history as one series — the demo should be showing that, not hiding it.
const RPE_UNTIL = 3
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Deterministic PRNG — the demo should look the same on every visit and in screenshots.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const round = (w, step) => Math.round(w / step) * step
const at = (date, h, m) => { const d = new Date(date); d.setHours(h, m, 0, 0); return d.getTime() }
// The Monday of a date. The effort trend is plotted per calendar week, so the training block
// has to run on calendar weeks too — a deload counted off the first day of the history would
// straddle two points and average itself away in both.
const monday = date => { const d = new Date(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(12, 0, 0, 0); return +d }

// A full example profile: 12 weeks of Mon/Wed/Fri sessions on the starter plan, with linear
// progression, the odd missed session, twice-weekly weigh-ins trending toward the goal, and
// per-set effort ratings on most (not all) of it.
export function buildDemoState() {
  const rnd = rng(20260723)
  const [push, pull, legs] = starterRoutines()
  const byWeekday = { 1: push, 3: pull, 5: legs }

  const nowH = new Date().getHours()
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const start = new Date(today); start.setDate(start.getDate() - WEEKS * 7)

  const workouts = []
  const bodyweight = []
  const exWeights = {}
  const best = {}

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const day = new Date(d)
    const iso = isoOf(day)
    const weekIdx = Math.floor((day - start) / (7 * 86400000))
    const p = Math.min(1, weekIdx / WEEKS)

    // weigh-ins: Monday and Thursday mornings
    if (day.getDay() === 1 || day.getDay() === 4) {
      const w = BW_FROM + (BW_TO - BW_FROM) * p + (rnd() - 0.5) * 0.7
      bodyweight.push({ d: iso, w: Math.round(w * 10) / 10, t: at(day, 7, 30) })
    }

    const routine = byWeekday[day.getDay()]
    if (!routine) continue
    if (rnd() < 0.09) continue                      // life happens — a few missed sessions
    if (iso === isoOf(today) && nowH < 18) continue   // leave today's session to try out, unless it's already evening

    const prs = []
    const blockWk = Math.round((monday(day) - monday(start)) / (7 * 86400000))
    const rir0 = weekTarget(blockWk)
    const scale = blockWk < RPE_UNTIL ? 'rpe' : 'rir'
    const entries = routine.ex.map((cfg, exIdx) => {
      const [base, inc] = PROG[cfg.id] || [20, 0.5]
      const step = base >= 40 ? 2.5 : 1.25
      // The deload pulls the weight back too — effort dropping on its own would look like the
      // same session suddenly got easy.
      const back = blockWk === DELOAD_WEEK ? 0.88 : 1
      const w = base ? Math.max(step, round((base + inc * weekIdx) * back, step)) : 0
      const rateable = modeOf(cfg) === 'reps' && cfg.id !== NEVER_RATED
      const sets = []
      for (let i = 0; i < cfg.sets; i++) {
        // last set is where reps usually start slipping
        const drop = i === cfg.sets - 1 && rnd() < 0.55 ? (rnd() < 0.4 ? 2 : 1) : 0
        const s = { w, r: Math.max(4, cfg.reps - drop), done: true }
        const rir = clamp(round(rir0
          + (cfg.sets - 1 - i) * 0.6      // a first set sits further from failure than a last
          - exIdx * 0.12                  // …and fatigue accumulates across the session
          + (EASY.has(cfg.id) ? 1.2 : 0)
          - (drop ? 0.5 : 0)              // reps slipping is the set that ran out of room
          + (rnd() - 0.5), 0.5), 0, 6)
        if (rateable && rnd() > UNRATED) {
          // RPE's floor of 6 is a convention about which sets are worth rating, so an easy
          // set logged in RPE genuinely loses the distance it was from failure.
          if (scale === 'rpe') s.rpe = clamp(10 - rir, 6, 10)
          else s.rir = rir
        }
        sets.push(s)
      }
      if (w > (best[cfg.id] || 0)) { best[cfg.id] = w; prs.push(cfg.id) }
      exWeights[cfg.id] = { w: Math.max(w, exWeights[cfg.id]?.w || 0), d: iso }
      return { id: cfg.id, sets, topW: w || null }
    })

    const bw = bodyweight.length ? bodyweight[bodyweight.length - 1].w : BW_FROM
    const startMs = at(day, 18, 5 + Math.floor(rnd() * 25))
    const w = {
      id: uid(), d: iso, start: startMs, end: startMs + (46 + Math.floor(rnd() * 26)) * 60000,
      routineId: routine.id, name: routine.name, bw,
      entries,
      prs: weekIdx === 0 ? [] : prs   // the very first session isn't a PR party
    }
    w.vol = entries.reduce((v, e) => v + e.sets.reduce((n, s) => n + s.w * s.r, 0), 0)
    workouts.push(w)
  }

  // A visitor should always have something to press "Start" on, so if they land on a rest day
  // the next routine in the rotation is moved onto today — which also shows off rescheduling.
  const dayPlan = {}
  const tIso = isoOf(today)
  if (!byWeekday[today.getDay()] && !workouts.some(w => w.d === tIso)) {
    const order = [push, pull, legs]
    const lastName = workouts.length ? workouts[workouts.length - 1].name : legs.name
    dayPlan[tIso] = order[(order.findIndex(r => r.name === lastName) + 1) % order.length].id
  }

  // Build nutrition log (separate rng stream so adding/changing food data doesn't shift
  // the workout fabrication above).
  const rndN = rng(20260723 + 1)
  const workoutSet = new Set(workouts.map(w => w.d))
  const nutritionLog = buildNutritionLog(rndN, start, today, workoutSet)

  // TDEE history snapshots across the 12-week cut (weight drops → BMR drops slightly).
  const nutriHistory = []
  for (let wk = 0; wk <= WEEKS; wk += 3) {
    const p = wk / WEEKS
    const wKg = Math.round((BW_FROM + (BW_TO - BW_FROM) * p) * 10) / 10
    const bmr  = Math.round(10 * wKg + 6.25 * 178 - 5 * 28 + 5)
    const tdee = Math.round(bmr * 1.35 + bmr * (0.1 / 7) * 3)   // matches calcTDEE in nutrition.js
    const d = new Date(start); d.setDate(d.getDate() + wk * 7)
    nutriHistory.push({ date: isoOf(d), bmr, tdee, weightKg: wKg })
  }

  return {
    routines: [push, pull, legs],
    week: { 1: push.id, 3: pull.id, 5: legs.id },
    dayPlan,
    workouts, bodyweight, exWeights,
    targetW: TARGET_W,
    effort: 'rir',
    nutrition: { ...DEMO_NUTRI, history: nutriHistory },
    nutritionLog,
  }
}
