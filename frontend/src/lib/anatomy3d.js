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

// Resolves a clicked mesh's raw name to its muscle key, or null if the mesh
// isn't part of the muscle-mesh map (e.g. a bone or connective-tissue mesh).
export function muscleKeyForMesh(meshName) {
  const normalized = stripBlenderSuffix(meshName).replace(/_/g, ' ')
  return MESH_NAME_TO_KEY[normalized] ?? null
}

// Every exercise whose exercise_muscles includes this key with a positive
// value, sorted by that key's activation descending.
export function exercisesTargeting(muscleKey) {
  return EXDB
    .filter(ex => (ex.exercise_muscles?.[muscleKey] ?? 0) > 0)
    .sort((a, b) => b.exercise_muscles[muscleKey] - a.exercise_muscles[muscleKey])
}
