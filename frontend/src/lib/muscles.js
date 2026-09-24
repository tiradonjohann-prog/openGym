// Which muscles an exercise trains, and how hard — the data behind every muscle map.
//
// The SmartWorkout catalog names muscles with specific uppercase keys (`exercise_muscles`,
// e.g. `GLUTEUS_MAXIMUS`, `CHEST_UPPER`) and gives a 0-100 activation per muscle. A
// residual handful of legacy custom/imported exercises (created by the CSV importer or
// carried over from the pre-swap dataset) instead carry only the old free-text `tg`/`sm`
// fields ("shoulders", "deltoids", "delts", "quads", "quadriceps", "lats", "latissimus
// dorsi", "core", "abdominals", …). Both vocabularies collapse onto the eighteen muscles
// the body map can actually draw, via MUSCLE_KEY_ALIAS (new keys) and ALIAS (legacy free
// text) below. Anything genuinely undrawable (hands, ankles, "cardiovascular system")
// maps to null and is dropped rather than guessed at.

import { EXIDX, musclesOf as activationsOf } from './exercises.js'

// The muscles a map can shade, in head-to-toe order — also the order of any list
// built from them, so "what am I neglecting" reads top-down like a body.
export const MUSCLES = [
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus',
  'biceps', 'triceps', 'forearm',
  'abs', 'obliques', 'lower-back',
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors',
  'calves', 'tibialis',
]

// Drawn as the silhouette, never shaded: they carry no training load.
export const INERT = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles']

// English display names; these strings are the i18n keys (see lib/i18n.js).
export const MUSCLE_NAME = {
  trapezius: 'Traps', deltoids: 'Shoulders', chest: 'Chest', 'upper-back': 'Upper back',
  serratus: 'Serratus', biceps: 'Biceps', triceps: 'Triceps', forearm: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', 'lower-back': 'Lower back', gluteal: 'Glutes',
  quadriceps: 'Quads', hamstring: 'Hamstrings', adductors: 'Adductors',
  'hip-flexors': 'Hip flexors', calves: 'Calves', tibialis: 'Shins',
}

// Every spelling that occurs in the dataset's `tg` and `sm` fields. null = not drawable.
const ALIAS = {
  // primaries
  abs: 'abs', pectorals: 'chest', biceps: 'biceps', glutes: 'gluteal', delts: 'deltoids',
  triceps: 'triceps', 'upper back': 'upper-back', lats: 'upper-back', calves: 'calves',
  quads: 'quadriceps', forearms: 'forearm', hamstrings: 'hamstring', spine: 'lower-back',
  traps: 'trapezius', adductors: 'adductors', 'serratus anterior': 'serratus',
  abductors: 'gluteal', 'levator scapulae': 'trapezius', 'cardiovascular system': null,
  // secondaries
  shoulders: 'deltoids', deltoids: 'deltoids', 'rear deltoids': 'deltoids',
  'rotator cuff': 'deltoids', quadriceps: 'quadriceps', core: 'abs', abdominals: 'abs',
  'lower abs': 'abs', chest: 'chest', 'upper chest': 'chest', 'hip flexors': 'hip-flexors',
  obliques: 'obliques', 'lower back': 'lower-back', rhomboids: 'upper-back',
  trapezius: 'trapezius', back: 'upper-back', 'latissimus dorsi': 'upper-back',
  brachialis: 'biceps', soleus: 'calves', shins: 'tibialis', wrists: 'forearm',
  'wrist flexors': 'forearm', 'wrist extensors': 'forearm', 'grip muscles': 'forearm',
  groin: 'adductors', 'inner thighs': 'adductors',
  ankles: null, feet: null, hands: null, 'ankle stabilizers': null,
  sternocleidomastoid: null,
}

// Every `exercise_muscles` key the SmartWorkout catalog uses, mapped onto the same
// eighteen drawable muscles as ALIAS above. Lowercased at lookup time the same way ALIAS
// is, so both tables share the one `add()` helper in musclesOf().
const MUSCLE_KEY_ALIAS = {
  abs_lower: 'abs', abs_upper: 'abs', abs_obliques: 'obliques',
  back_lats: 'upper-back', back_trapezius_upper: 'trapezius', back_trapezius_middle: 'trapezius',
  back_trapezius_lower: 'trapezius', back_infraspinatus: 'deltoids', back_teres_major: 'upper-back',
  back_teres_minor: 'deltoids',
  biceps_long_head: 'biceps', biceps_short_head: 'biceps', brachioradialis: 'forearm',
  chest_upper: 'chest', chest_middle: 'chest', chest_lower: 'chest', chest_big_swing_muscle: 'chest',
  gluteus_maximus: 'gluteal', gluteus_medius: 'gluteal',
  shoulders_front_part: 'deltoids', shoulders_middle_part: 'deltoids', shoulders_rear_part: 'deltoids',
  triceps_lateral_head: 'triceps', triceps_long_head: 'triceps', triceps_medial_head: 'triceps',
  quadriceps_rectus_femoris: 'quadriceps', quadriceps_vastus_lateralis: 'quadriceps',
  quadriceps_vastus_medialis: 'quadriceps', quadriceps_vastus_intermedius: 'quadriceps',
  erector_spinae: 'lower-back',
  claves_gastrocnemius: 'calves', claves_soleus_muscle: 'calves', claves_tribialis: 'tibialis',
  biceps_femoris: 'hamstring', semimembranosus: 'hamstring', semitendinosus: 'hamstring',
  adductor_longus: 'adductors', adductor_magnus: 'adductors',
  forearm_extensors: 'forearm', forearm_flexors: 'forearm',
  iliopsoas: 'hip-flexors', gracilis: 'adductors', pectineus: 'adductors', sartorius: 'hip-flexors',
}

// Custom exercises carry only a body part, so they fall back to it. Weights inside a
// group sum to 1 — "upper legs" spreads over three muscles rather than counting triple.
const BY_BODYPART = {
  chest: { chest: 1 },
  back: { 'upper-back': 0.75, 'lower-back': 0.25 },
  shoulders: { deltoids: 1 },
  'upper arms': { biceps: 0.5, triceps: 0.5 },
  'lower arms': { forearm: 1 },
  waist: { abs: 0.7, obliques: 0.3 },
  'upper legs': { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 },
  'lower legs': { calves: 0.8, tibialis: 0.2 },
  neck: { trapezius: 1 },
  cardio: {},
}

const SECONDARY = 0.4   // a supporting muscle counts this much against a primary

/** Muscles one exercise trains: { slug: 0…1 }. */
export function musclesOf(ex) {
  if (!ex) return {}
  const out = {}
  const add = (name, w) => {
    const slug = MUSCLE_KEY_ALIAS[String(name || '').toLowerCase().trim()] ||
      ALIAS[String(name || '').toLowerCase().trim()]
    if (slug) out[slug] = Math.max(out[slug] || 0, w)
  }
  const activations = activationsOf(ex)
  if (activations.length) {
    // SmartWorkout catalog exercise: weighted per-muscle activation (0-100%).
    activations.forEach(({ key, value }) => add(key, value / 100))
  } else {
    // Legacy custom/imported exercise: only the old free-text tg/sm fields are set.
    add(ex.tg, 1)
    ;(ex.sm || []).forEach(m => add(m, SECONDARY))
  }
  // Nothing recognised (custom exercises, or a target we don't draw) — use the body part.
  if (!Object.keys(out).length) {
    Object.assign(out, BY_BODYPART[ex.bp] || BY_BODYPART[String(ex.bp || '').toLowerCase()] || {})
  }
  return out
}

/**
 * Training load per muscle, in "effective sets".
 * `items` is [{ id, sets }] — sets being a count, so a 4×8 bench press weighs four
 * times a single set. Volume in kg is deliberately not used: 100 kg of leg press
 * against 12 kg of lateral raise says nothing about which muscle worked harder.
 */
export function loadOf(items) {
  const load = {}
  items.forEach(({ id, sets }) => {
    if (!sets) return
    const m = musclesOf(EXIDX[id])
    for (const slug in m) load[slug] = (load[slug] || 0) + m[slug] * sets
  })
  return load
}

/**
 * Load for finished workouts (only sets actually ticked off count). `pick` narrows that
 * further — the map can then answer "where did the *hard* sets go", which is a different
 * question from where the sets went: a muscle can lead on volume and still never be trained
 * near failure.
 */
export const loadOfWorkouts = (workouts, pick) =>
  loadOf((workouts || []).flatMap(w =>
    (w.entries || []).map(e => ({ id: e.id, sets: (e.sets || []).filter(s => s.done && (!pick || pick(s))).length }))))

/** Load a routine *would* produce, from its planned set counts. */
export const loadOfRoutine = routine => {
  const exList = routine?.items
    ? routine.items.filter(x => x.kind === 'ex')
    : (routine?.ex || [])
  return loadOf(exList.map(c => ({ id: c.id, sets: c.sets || 1 })))
}

/** Load for a workout still in progress — the sets ticked so far. */
export const loadOfActive = active =>
  loadOf((active?.entries || []).map(e => ({ id: e.id, sets: (e.sets || []).filter(s => s.done).length })))

/**
 * Shade buckets 0–4 per muscle, relative to the hardest-worked muscle in the same
 * window. Relative rather than absolute on purpose: the map answers "is my training
 * balanced", which only means anything as a comparison within one period.
 */
export function levelsOf(load) {
  const max = Math.max(0, ...MUSCLES.map(m => load[m] || 0))
  const lv = {}
  MUSCLES.forEach(m => {
    const v = load[m] || 0
    lv[m] = !v ? 0 : max <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil(v / max * 4)))
  })
  return lv
}

/** Muscles sorted hardest-worked first; untrained ones last, in body order. */
export function rankOf(load) {
  const worked = MUSCLES.filter(m => (load[m] || 0) > 0).sort((a, b) => load[b] - load[a])
  const missed = MUSCLES.filter(m => !(load[m] > 0))
  return { worked, missed }
}
