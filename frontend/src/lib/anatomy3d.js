import muscleMeshMap from './muscle-mesh-map.json'
import { EXDB } from './exercises.js'

// Reverse lookup: mesh base name (spaces, no L/R suffix) -> muscle key.
// A mesh's raw name in the GLB can carry a Blender numeric suffix (".001") or a
// left/right suffix (_l, _r, .L, .R) that muscle-mesh-map.json's base names don't
// include — both are stripped before lookup, and both directions of the map are
// pre-expanded here so lookups are a single object read, not a scan per mesh.
const MESH_NAME_TO_KEY = {}
function addMeshName(base, key) {
  const normalized = base.replace(/_/g, ' ')
  if (!(normalized in MESH_NAME_TO_KEY)) MESH_NAME_TO_KEY[normalized] = key
}
for (const [key, { meshes }] of Object.entries(muscleMeshMap)) {
  for (const base of meshes) {
    addMeshName(base, key)
    for (const sep of ['', '.', '_']) {
      for (const lr of ['l', 'r', 'L', 'R']) addMeshName(base + sep + lr, key)
    }
  }
}

function stripBlenderSuffix(name) {
  return name.replace(/\.\d+$/, '')
}

// This GLB duplicates every muscle mesh 2-3x with an extra infix before the
// left/right side letter — e.g. "musclel" (base), "muscleol" ("o" variant),
// "musclee1l"/"musclee2l" ("e"/"e1"/"e2" variants) — almost certainly
// outline/shell duplicates for the toon-shader look. muscle-mesh-map.json
// only lists the base name, so a raycast hit on one of these duplicates
// needs the infix stripped before lookup.
const VARIANT_INFIXES = ['e2', 'e1', 'e', 'o']

// Resolves a clicked mesh's raw name to its muscle key, or null if the mesh
// isn't part of the muscle-mesh map (e.g. a bone or connective-tissue mesh).
export function muscleKeyForMesh(meshName) {
  const normalized = stripBlenderSuffix(meshName).replace(/_/g, ' ')
  const direct = MESH_NAME_TO_KEY[normalized]
  if (direct != null) return direct

  const base = stripVariantInfix(normalized)
  if (base === normalized) return null
  return MESH_NAME_TO_KEY[base] ?? null
}

// True when this mesh's name carries one of the extra-infix duplicate
// markers (see VARIANT_INFIXES above) AND the plain base name it duplicates
// also exists in the GLB — i.e. this mesh is one of the redundant
// overlapping copies, not the sole representation of that body part. These
// duplicates all occupy virtually the same geometry, so leaving them all
// visible causes z-fighting that hides whatever material (heatmap/selected
// color) was applied to the base mesh. `knownMeshNames` is the full set of
// raw mesh names in the loaded GLB.
export function isDuplicateMeshVariant(meshName, knownMeshNames) {
  const normalized = stripBlenderSuffix(meshName).replace(/_/g, ' ')
  const base = stripVariantInfix(normalized)
  if (base === normalized) return false
  const baseRaw = base.replace(/ /g, '_')
  return knownMeshNames.has(baseRaw) && baseRaw !== meshName
}

function stripVariantInfix(normalized) {
  const side = normalized.slice(-1)
  const isSided = side === 'l' || side === 'r' || side === 'L' || side === 'R'
  const stem = isSided ? normalized.slice(0, -1) : normalized
  for (const infix of VARIANT_INFIXES) {
    if (stem.endsWith(infix)) return isSided ? stem.slice(0, -infix.length) + side : stem.slice(0, -infix.length)
  }
  return normalized
}

// Every exercise whose exercise_muscles includes this key with a positive
// value, sorted by that key's activation descending.
export function exercisesTargeting(muscleKey) {
  return EXDB
    .filter(ex => (ex.exercise_muscles?.[muscleKey] ?? 0) > 0)
    .sort((a, b) => b.exercise_muscles[muscleKey] - a.exercise_muscles[muscleKey])
}
