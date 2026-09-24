// frontend/src/lib/exercises.js
import { EXDB } from './exercises-data.js'
import { t } from './i18n.js'

export { EXDB }
export const EXIDX = {}
EXDB.forEach(e => { EXIDX[e.id] = e })
export const BODYPARTS = [...new Set(EXDB.map(e => e.bp))].sort()

// Equipment options present in a given list of exercises, most common first (issue #6).
// Deriving them from the *already filtered* list keeps the chip row short and means
// every body-part × equipment combination on screen has results behind it.
export function equipmentOf(list) {
  const c = {}
  list.forEach(e => { if (e.eq) c[e.eq] = (c[e.eq] || 0) + 1 })
  return Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))
}

// Custom (user-created) exercises live in synced state S.customEx (issue #11) and are
// merged into the id index here so every EXIDX[id] lookup keeps working unchanged.
let customIds = []
export function registerCustom(list) {
  customIds.forEach(id => delete EXIDX[id])
  customIds = (list || []).map(e => e.id)
  ;(list || []).forEach(e => { EXIDX[e.id] = e })
}
// Full searchable catalogue — customs first so your own exercises are easy to find.
export const allExercises = st => [...(st.customEx || []), ...EXDB]

// Legacy media (residual cardio exercises only) — img/ and gif/, mounted next to the app.
const IMG_BASE = import.meta.env.VITE_IMG_BASE || 'img/'
const GIF_BASE = import.meta.env.VITE_GIF_BASE || 'gif/'
export const imgSrc = ex => IMG_BASE + ex.img
export const gifSrc = ex => GIF_BASE + ex.gif

// SmartWorkout video — CDN-first, with a local-hosting fallback that isn't populated
// by default (drop .mp4 files into frontend/public/videos/ to activate it, no code change).
export const videoSrc = ex => {
  if (ex.video_dark_url) return ex.video_dark_url
  if (ex.video_light_url) return ex.video_light_url
  if (ex.local_video) return ex.local_video.replace(/^\/Videos\//i, '/videos/')
  return null
}

// SmartWorkout static photo (exercises without a usable video fall back to this).
export const photoSrc = ex => ex.image_url || null

// Muscle activation (0-100%) from SmartWorkout's `exercise_muscles` — used by the
// detail sheet and the muscle filter.
export function musclesOf(ex) {
  const m = ex.exercise_muscles
  if (!m || typeof m !== 'object') return []
  return Object.entries(m)
    .filter(([, v]) => typeof v === 'number' && !isNaN(v))
    .map(([key, value]) => ({ key, value }))
}
export function sortedMuscles(ex) {
  return musclesOf(ex).sort((a, b) => b.value - a.value)
}

// Cardio exercises log time + speed instead of weight × reps.
export const isCardio = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.bp === 'CARDIO'

// Exercises the dataset already knows carry no external load (issue #32) — seeds the
// `bw` flag on a fresh config so a push-up never asks for a weight nobody was going to
// enter. It is only the default: the flag lives on the config, so a dip done with a belt
// can turn it off and a custom exercise can turn it on.
export const isBodyweightEq = idOrEx =>
  (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.eq === 'body weight'

// An id that resolves to nothing — a plan file built against a different exercise dataset,
// a custom exercise deleted on another device before the sync arrived — still has to
// render. A placeholder keeps it visible (and removable) instead of taking the whole view
// down on the first `ex.n`.
export const exOr = id => EXIDX[id] ||
  { id, n: t('Unknown exercise'), bp: '', tg: '', eq: '', sm: [], st: [], missing: true }
