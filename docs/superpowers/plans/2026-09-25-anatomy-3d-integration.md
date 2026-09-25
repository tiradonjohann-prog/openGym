# Anatomy 3D Integration (MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lazy-loaded 3D anatomy view to OpenGym — rotate/zoom a body model matching the user's profile sex, see a heatmap of muscles worked from any exercise's detail sheet, and click a muscle to find every exercise that targets it.

**Architecture:** Vendor the minimum necessary files from the sibling `anatomy-viewer` project (3D model assets, the SmartWorkout-muscle-to-mesh mapping, small pure-logic helpers) into OpenGym. Write a new, deliberately trimmed `AnatomyModel.jsx` — the source component in `anatomy-viewer` also drives layer switching, isolation, ghost-bone overlays, and depth-based x-ray focus (all phase-2 features per the spec); porting it verbatim would drag that whole state machine in. The MVP keeps only what it needs: classify meshes into anatomical layers (muscle vs. bone/ligament/organ/skin) so only the muscle layer renders, color muscles by heatmap value, and handle clicks — using the same pure classification functions as the source, copied verbatim since they have no dependency on the parts being cut.

**Tech Stack:** React 19, `three`, `@react-three/fiber`, `@react-three/drei` (new dependencies), Vitest, `react-router-dom` (`HashRouter`, already in use).

**Spec:** `docs/superpowers/specs/2026-09-25-anatomy-3d-integration-design.md`

## Global Constraints

- Lazy loading only: Three.js/R3F/drei and the `.glb` models load via `React.lazy()` — zero impact on OpenGym's existing initial bundle.
- MVP scope only: free rotate/zoom, heatmap from an exercise, click-muscle → exercise list. No search, no layer switching UI, no isolation mode, no controls guide, no avatar head, no split front/back view. These are deferred, not removed — architected so adding them later means adding files, not rewriting the MVP.
- Model choice follows `S.nutrition.sex` (`'male' | 'female' | 'other' | null`, already used by the existing 2D body diagram and nutrition BMR calc) — `'female'` loads `female.glb`, anything else (`'male'`, `'other'`, `null`) loads `male.glb`.
- WebGL availability must be checked before mounting the Canvas; render a fallback message instead of a blank/crashed screen if unavailable.
- Web-first: no Capacitor-specific handling in this plan. Do not add mobile-only code paths.
- `exercises-by-muscle.json` and `muscles-index.json` are explicitly NOT ported — the muscle→exercise list is computed from OpenGym's own `EXDB` at runtime.
- Route uses OpenGym's existing `HashRouter` (`src/App.jsx`) — a new `<Route path="/anatomy" element={...} />` alongside the existing routes, no new routing library or convention.

## Review Focus

- **A muscle key in `muscle-mesh-map.json` that doesn't exist on any current OpenGym exercise** (the map has 44 keys; OpenGym's `exercise_muscles` values are drawn from the same 44-key vocabulary, but a future catalog regeneration could drop one) — `exercisesTargeting` must return `[]`, not throw, for a key with zero matches. Pinned in Task 2.
- **An exercise whose `exercise_muscles` is empty or absent** (residual cardio exercises have no `exercise_muscles` field) when its detail sheet's "View in 3D" affordance is reached — `meshesForMuscles` must return `[]` rather than throwing, and the button should not appear at all in that case. Pinned in Task 2 and Task 6.
- **A muscle key present in `exercise_muscles` with value `0`** (seen in real data — a muscle listed but not actually worked) — must not render as "activated" in the heatmap or count as a match for that muscle's exercise list. Pinned in Task 2.
- **WebGL unavailable** (old browser, disabled GPU) — must show the fallback message, never a blank canvas or a thrown error that takes down the rest of the app. Pinned in Task 4.
- **User has no profile sex set (`null`)** — a fresh install or a user who skipped onboarding must still get a working default model (`male.glb`), not a broken model load. Pinned in Task 4.

---

### Task 1: Vendor assets and add 3D dependencies

**Files:**
- Create: `frontend/src/lib/muscle-mesh-map.json` (copy of `anatomy-viewer/src/data/sw-muscle-map.json`)
- Create: `frontend/src/lib/dragGuard.js` (copy of `anatomy-viewer/src/lib/dragGuard.js`)
- Create: `frontend/src/lib/heatmapColor.js` (copy of `anatomy-viewer/src/lib/heatmapColor.js`)
- Create: `frontend/public/models/male.glb`, `frontend/public/models/female.glb` (copies of the same files in `anatomy-viewer/public/models/`)
- Modify: `frontend/package.json` (add `three`, `@react-three/fiber`, `@react-three/drei`)

**Interfaces:**
- Produces: `muscle-mesh-map.json` — a JSON object keyed by 44 muscle codes (`ABS_LOWER`, `BACK_LATS`, ...), each value `{ label: string, meshes: string[] }`. Consumed by Task 2 and Task 3.
- Produces: `dragGuard` (named export, object with `start(x, y)`, `check(x, y)`, getter `wasDrag`). Consumed by Task 3.
- Produces: `heatmapColor(pct)` (default-less named export, function `number → '#rrggbb'` string). Consumed by Task 3.

- [ ] **Step 1: Copy the vendored files**

```bash
cd "frontend"
mkdir -p public/models
cp "../../anatomy-viewer/src/data/sw-muscle-map.json" "src/lib/muscle-mesh-map.json"
cp "../../anatomy-viewer/src/lib/dragGuard.js" "src/lib/dragGuard.js"
cp "../../anatomy-viewer/src/lib/heatmapColor.js" "src/lib/heatmapColor.js"
cp "../../anatomy-viewer/public/models/male.glb" "public/models/male.glb"
cp "../../anatomy-viewer/public/models/female.glb" "public/models/female.glb"
```

(Adjust the `../../anatomy-viewer` prefix if your working directory differs — the source repo lives as a sibling of `openGym` under `OPENGYM APP/`. Verify the exact relative path with `ls ../../anatomy-viewer/public/models/` before copying if unsure.)

- [ ] **Step 2: Verify the copies**

```bash
node -e "const d = require('./src/lib/muscle-mesh-map.json'); console.log(Object.keys(d).length)"
ls -la public/models/male.glb public/models/female.glb
```

Expected: `44` printed, and both `.glb` files present (~7.7 MB each).

- [ ] **Step 3: Add the 3D dependencies**

```bash
npm install three@^0.185.1 @react-three/fiber@^9.7.0 @react-three/drei@^10.7.8
```

- [ ] **Step 4: Verify the install and existing suite still pass**

```bash
npx vitest run
npx vite build
```

Expected: full existing suite still green (no test touches these new files yet), build still succeeds. The new dependencies are not imported anywhere yet, so this just confirms nothing broke.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/muscle-mesh-map.json frontend/src/lib/dragGuard.js frontend/src/lib/heatmapColor.js frontend/public/models/male.glb frontend/public/models/female.glb frontend/package.json frontend/package-lock.json
git commit -m "chore: vendor anatomy 3D assets and add Three.js/R3F dependencies"
```

---

### Task 2: `lib/anatomy3d.js` — pure mesh/muscle/exercise logic

**Files:**
- Create: `frontend/src/lib/anatomy3d.js`
- Test: `frontend/src/lib/anatomy3d.test.js`

**Interfaces:**
- Consumes: `muscle-mesh-map.json` (Task 1), `EXDB` from `frontend/src/lib/exercises.js` (existing).
- Produces:
  - `meshesForMuscles(exerciseMuscles)` — `{[key: string]: number} → { meshName: string, value: number }[]`. Consumed by Task 4.
  - `muscleKeyForMesh(meshName)` — `string → string | null`. Consumed by Task 3.
  - `exercisesTargeting(muscleKey)` — `string → Exercise[]`, sorted by descending activation for that key. Consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

```js
// frontend/src/lib/anatomy3d.test.js
import { describe, it, expect } from 'vitest'
import { meshesForMuscles, muscleKeyForMesh, exercisesTargeting } from './anatomy3d.js'

describe('meshesForMuscles', () => {
  it('translates an activation map into mesh entries with their value', () => {
    const result = meshesForMuscles({ CHEST_MIDDLE: 100, ABS_OBLIQUES: 40 })
    const names = result.map(r => r.meshName).sort()
    expect(names).toContain('External abdominal oblique muscle')
    expect(names).toContain('Internal abdominal oblique muscle')
    const chest = result.find(r => r.value === 100)
    expect(chest).toBeTruthy()
  })

  it('returns an empty array for an empty or missing muscle map', () => {
    expect(meshesForMuscles({})).toEqual([])
    expect(meshesForMuscles(undefined)).toEqual([])
    expect(meshesForMuscles(null)).toEqual([])
  })

  it('ignores a muscle key present with a value of 0', () => {
    const result = meshesForMuscles({ CHEST_MIDDLE: 0 })
    expect(result).toEqual([])
  })

  it('ignores a muscle key not present in muscle-mesh-map.json', () => {
    const result = meshesForMuscles({ NOT_A_REAL_KEY: 80 })
    expect(result).toEqual([])
  })
})

describe('muscleKeyForMesh', () => {
  it('resolves a known mesh name to its muscle key', () => {
    expect(muscleKeyForMesh('Latissimus dorsi muscle')).toBe('BACK_LATS')
  })

  it('resolves an L/R suffixed variant to the same key', () => {
    expect(muscleKeyForMesh('Latissimus dorsi muscle_l')).toBe('BACK_LATS')
    expect(muscleKeyForMesh('Latissimus dorsi muscle.R')).toBe('BACK_LATS')
  })

  it('returns null for an unknown mesh name', () => {
    expect(muscleKeyForMesh('Some Unrelated Object')).toBe(null)
  })
})

describe('exercisesTargeting', () => {
  it('returns a non-empty list for a common muscle key, sorted by descending activation', () => {
    const result = exercisesTargeting('CHEST_MIDDLE')
    expect(result.length).toBeGreaterThan(0)
    for (let i = 1; i < result.length; i++) {
      const prevVal = result[i - 1].exercise_muscles.CHEST_MIDDLE
      const curVal = result[i].exercise_muscles.CHEST_MIDDLE
      expect(prevVal).toBeGreaterThanOrEqual(curVal)
    }
  })

  it('returns an empty array for a muscle key no exercise targets', () => {
    expect(exercisesTargeting('NOT_A_REAL_KEY')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/anatomy3d.test.js`
Expected: FAIL — `anatomy3d.js` does not exist.

- [ ] **Step 3: Write `anatomy3d.js`**

```js
// frontend/src/lib/anatomy3d.js
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

// Translates an exercise's `exercise_muscles` activation map into the 3D mesh
// names that should be colored, with their activation value (0 excluded).
export function meshesForMuscles(exerciseMuscles) {
  if (!exerciseMuscles || typeof exerciseMuscles !== 'object') return []
  const out = []
  for (const [key, value] of Object.entries(exerciseMuscles)) {
    if (typeof value !== 'number' || value <= 0) continue
    const entry = muscleMeshMap[key]
    if (!entry) continue
    for (const meshName of entry.meshes) out.push({ meshName, value })
  }
  return out
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/anatomy3d.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/anatomy3d.js frontend/src/lib/anatomy3d.test.js
git commit -m "feat: add pure mesh/muscle/exercise mapping logic for 3D anatomy view"
```

---

### Task 3: `components/anatomy3d/AnatomyModel.jsx` — trimmed 3D body renderer

**Files:**
- Create: `frontend/src/components/anatomy3d/AnatomyModel.jsx`

**Interfaces:**
- Consumes: `dragGuard` (Task 1), `heatmapColor` (Task 1), `muscleKeyForMesh` (Task 2). `useGLTF` from `@react-three/drei` (Task 1's dependency).
- Produces: `<AnatomyModel modelUrl={string} heatmap={{[key: string]: number}} onMuscleClick={(muscleKey: string) => void} />` (default export `AnatomyModel`, named export `FallbackMesh`). Consumed by Task 4.

**Context on the trim:** the source `AnatomyModel.jsx` in `anatomy-viewer` also drives layer switching (bones/ligaments/organs/skin toggle), an isolation mode, a semi-transparent "ghost skeleton" overlay, and depth-based x-ray focus when a specific muscle is selected — all backed by a 10+ field Zustand store (`useViewerStore`). None of that is in this MVP's scope. What this component keeps, because the model's default layer (`'muscles'`) is what makes it readable at all — without filtering, bone/ligament/organ/skin meshes would render on top of and obscure the muscle layer — is the mesh **classification** logic that decides which meshes belong to the muscle layer, copied verbatim from the source since it has no dependency on the parts being cut.

- [ ] **Step 1: Write the component**

```jsx
// frontend/src/components/anatomy3d/AnatomyModel.jsx
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState, Component } from 'react'
import { dragGuard } from '../../lib/dragGuard.js'
import { heatmapColor } from '../../lib/heatmapColor.js'
import { muscleKeyForMesh } from '../../lib/anatomy3d.js'

// ─── Mesh layer classification (copied from anatomy-viewer's AnatomyModel.jsx,
//     it has no dependency on the layer-switching/isolation state this MVP cuts) ───

const BONE_WORDS = new Set([
  'bone', 'bones', 'os', 'ossa',
  'skull', 'cranium', 'calvaria',
  'frontal', 'parietal', 'occipital', 'temporal', 'sphenoid', 'ethmoid',
  'mandible', 'mandibula', 'maxilla', 'zygomatic',
  'vertebra', 'vertebrae', 'atlas', 'axis', 'sternum', 'manubrium',
  'rib', 'ribs',
  'clavicle', 'scapula', 'humerus', 'radius', 'ulna',
  'carpal', 'carpals', 'metacarpal', 'metacarpals', 'phalanx', 'phalanges',
  'pelvis', 'ilium', 'sacrum', 'coccyx', 'pubis', 'ischium',
  'femur', 'tibia', 'fibula', 'patella',
  'tarsal', 'tarsals', 'metatarsal', 'metatarsals',
  'calcaneus', 'talus', 'navicular', 'cuboid',
])
const LIGAMENT_WORDS = new Set([
  'ligament', 'ligaments', 'ligamentum', 'ligamenta',
  'tendon', 'tendinous', 'aponeurosis',
  'meniscus', 'menisci',
  'retinaculum', 'capsule',
  'acl', 'pcl', 'mcl', 'lcl',
])
const ORGAN_WORDS = new Set([
  'heart', 'lung', 'lungs', 'liver', 'kidney', 'kidneys',
  'stomach', 'intestine', 'intestines', 'organ',
])
const SKIN_WORDS = new Set(['skin', 'dermis', 'epidermis'])

function wordsOf(str) {
  return str.toLowerCase().split(/[\s_.,()[\]]+/).filter(Boolean)
}

function layerFromName(name) {
  const words = wordsOf(name)
  if (words.some(w => BONE_WORDS.has(w))) return 'bones'
  if (words.some(w => LIGAMENT_WORDS.has(w))) return 'ligaments'
  if (words.some(w => ORGAN_WORDS.has(w))) return 'organs'
  if (words.some(w => SKIN_WORDS.has(w))) return 'skin'
  return null
}

function layerFromMaterialName(mat) {
  if (!mat?.name) return null
  const n = mat.name.toLowerCase()
  if (n.includes('bone') || n.includes('skeletal') || n.includes('cortical')) return 'bones'
  if (n.includes('ligament') || n.includes('tendon') || n.includes('joint') || n.includes('capsule')) return 'ligaments'
  if (n.includes('muscle') || n.includes('muscul')) return 'muscles'
  if (n.includes('skin') || n.includes('dermis')) return 'skin'
  if (n.includes('organ') || n.includes('viscera') || n.includes('gland')) return 'organs'
  return null
}

function layerFromHierarchy(obj) {
  let cur = obj.parent
  while (cur) {
    const n = (cur.name || '').toLowerCase()
    if (n.includes('bone') || n.includes('skeleton') || n.includes('skeletal')) return 'bones'
    if (n.includes('ligament') || n.includes('joint') || n.includes('tendon')) return 'ligaments'
    if (n.includes('muscle') || n.includes('muscul')) return 'muscles'
    if (n.includes('organ') || n.includes('viscera')) return 'organs'
    if (n.includes('skin') || n.includes('integument')) return 'skin'
    cur = cur.parent
  }
  return null
}

function layerFromColor(mat) {
  if (!mat?.color) return null
  const { r, g, b } = mat.color
  const rdiff = r - g
  if (r > 0.5 && g > 0.5 && b >= 0.35 && rdiff < 0.25 && (r - b) < 0.45) return 'bones'
  return null
}

function getMeshLayer(mesh) {
  const n = layerFromName(mesh.name)
  if (n) return n
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  const mn = layerFromMaterialName(mat)
  if (mn) return mn
  const hn = layerFromHierarchy(mesh)
  if (hn) return hn
  const cn = layerFromColor(mat)
  if (cn) return cn
  return 'muscles'
}

const NON_CLICKABLE = [
  'fascia', 'bursa', 'bursae', 'aponeurosis', 'retinaculum', 'membrane',
  'tract', 'alba', 'septum', 'sheath', 'capsule', 'labrum', 'symphysis',
  'arch', 'zona', 'cord', 'investing', 'interosseous', 'iliotibial',
  'transversalis', 'crural', 'popliteal', 'deltoid fascia', 'lata',
]
function isNonClickable(name) {
  const n = name.toLowerCase()
  return NON_CLICKABLE.some(w => n.includes(w))
}

// ─── Materials ────────────────────────────────────────────────────────────────

let _muscleMat = null
function muscleMat() {
  if (!_muscleMat) {
    _muscleMat = new THREE.MeshPhysicalMaterial({
      color: '#B85858', roughness: 0.72, metalness: 0.0,
      sheen: 0.5, sheenRoughness: 0.75, sheenColor: new THREE.Color('#FF9090'),
      clearcoat: 0.12, clearcoatRoughness: 0.7,
    })
  }
  return _muscleMat
}

const heatmapMats = new Map()
function heatmapMat(pct) {
  const bucket = Math.round(pct / 5) * 5
  if (heatmapMats.has(bucket)) return heatmapMats.get(bucket)
  const color = new THREE.Color(heatmapColor(pct))
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.65, metalness: 0.02, emissive: color, emissiveIntensity: 0.2,
  })
  heatmapMats.set(bucket, mat)
  return mat
}

const DIM_MAT = new THREE.MeshStandardMaterial({
  color: '#888888', roughness: 0.78, metalness: 0.01,
  transparent: true, opacity: 0.35, depthWrite: false,
})

// ─── Fallback + error boundary ─────────────────────────────────────────────────

export function FallbackMesh() {
  return (
    <mesh>
      <boxGeometry args={[0.6, 1.8, 0.3]} />
      <meshStandardMaterial color="#444444" transparent opacity={0.7} />
    </mesh>
  )
}

class ModelErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

// ─── Model content ──────────────────────────────────────────────────────────────

function ModelContent({ modelUrl, heatmap, onMuscleClick }) {
  const { scene } = useGLTF(modelUrl)
  const groupRef = useRef()
  const [ready, setReady] = useState(false)

  const meshes = useMemo(() => {
    const acc = []
    scene.traverse(obj => {
      if (!obj.isMesh) return
      obj.userData.layer = getMeshLayer(obj)
      obj.userData.clickable = !isNonClickable(obj.name)
      if (!obj.userData.clickable) obj.raycast = () => {}
      acc.push(obj)
    })
    return acc
  }, [scene])

  useEffect(() => {
    const hasHeatmap = heatmap && Object.keys(heatmap).length > 0
    for (const mesh of meshes) {
      if (mesh.userData.layer !== 'muscles') {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      if (!hasHeatmap) {
        mesh.material = muscleMat()
        continue
      }
      const key = muscleKeyForMesh(mesh.name)
      const pct = key ? (heatmap[key] ?? 0) : 0
      mesh.material = pct > 0 ? heatmapMat(pct) : DIM_MAT
    }
    setReady(true)
  }, [meshes, heatmap])

  function handleClick(e) {
    e.stopPropagation()
    if (dragGuard.wasDrag) return
    const mesh = e.object
    if (!mesh?.isMesh) return
    if (mesh.userData.layer !== 'muscles' || !mesh.userData.clickable) return
    const key = muscleKeyForMesh(mesh.name)
    if (key) onMuscleClick(key)
  }

  return (
    <group ref={groupRef} onClick={handleClick} visible={ready}>
      <primitive object={scene} />
    </group>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export function AnatomyModel({ modelUrl, heatmap, onMuscleClick }) {
  return (
    <ModelErrorBoundary fallback={<FallbackMesh />}>
      <ModelContent modelUrl={modelUrl} heatmap={heatmap} onMuscleClick={onMuscleClick} />
    </ModelErrorBoundary>
  )
}
```

- [ ] **Step 2: Verify it compiles** (no unit test for this file — it's a Three.js/WebGL component with no jsdom-testable behavior; correctness is verified visually in Task 8)

Run: `cd frontend && npx vite build`
Expected: build succeeds (this file isn't imported by anything yet, so this only checks for syntax errors — full verification happens once Task 4 wires it up)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/anatomy3d/AnatomyModel.jsx
git commit -m "feat: add trimmed 3D anatomy model renderer (muscle layer + heatmap + click)"
```

---

### Task 4: `views/AnatomyView.jsx` — the 3D view page

**Files:**
- Create: `frontend/src/views/AnatomyView.jsx`
- Test: `frontend/src/views/AnatomyView.test.js` (WebGL-detection helper only — the rest is a Canvas component, not unit-testable in jsdom)

**Interfaces:**
- Consumes: `AnatomyModel` (Task 3), `exercisesTargeting` (Task 2), `EXIDX`/`exOr` from `exercises.js` (existing), `useStore` (existing, for `S.nutrition.sex`), `exerciseDetailSheet` from `sheets.jsx` (existing), `openSheet`-style bottom sheet pattern already used across the app (check `sheets.jsx`'s existing `ui()` / sheet helpers for the exact call before writing this file — reuse the established pattern rather than inventing a new modal).
- Produces: default export `AnatomyView` (a route component, reads `useLocation().state.muscles` for a pre-loaded heatmap, works with no state for free exploration). Consumed by Task 5.

- [ ] **Step 1: Write the failing test for the WebGL-detection helper**

```js
// frontend/src/views/AnatomyView.test.js
import { describe, it, expect, vi } from 'vitest'
import { hasWebGL } from './AnatomyView.jsx'

describe('hasWebGL', () => {
  it('returns true when the canvas reports a webgl2 context', () => {
    const fakeCanvas = { getContext: vi.fn(ctx => (ctx === 'webgl2' ? {} : null)) }
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas)
    expect(hasWebGL()).toBe(true)
    document.createElement.mockRestore()
  })

  it('returns false when neither webgl2 nor webgl is available', () => {
    const fakeCanvas = { getContext: vi.fn(() => null) }
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas)
    expect(hasWebGL()).toBe(false)
    document.createElement.mockRestore()
  })

  it('returns false instead of throwing if getContext itself throws', () => {
    const fakeCanvas = { getContext: vi.fn(() => { throw new Error('no GPU') }) }
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas)
    expect(hasWebGL()).toBe(false)
    document.createElement.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/AnatomyView.test.js`
Expected: FAIL — `AnatomyView.jsx` does not exist.

- [ ] **Step 3: Read `sheets.jsx`'s bottom-sheet pattern before writing the muscle-click panel**

Open `frontend/src/sheets.jsx` and find the exported sheet-opening helper (search for `openSheet` or `ui()` — the same mechanism `exerciseDetailSheet`/`addToRoutineSheet` use). Use that exact same mechanism for the "exercises targeting this muscle" panel in Step 4 below — do not build a second, parallel modal system.

- [ ] **Step 4: Write `AnatomyView.jsx`**

```jsx
// frontend/src/views/AnatomyView.jsx
import { Suspense, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useStore } from '../store/useStore.js'
import { AnatomyModel } from '../components/anatomy3d/AnatomyModel.jsx'
import { exercisesTargeting } from '../lib/anatomy3d.js'
import { muscleLabel } from '../lib/exerciseLabels.js'
import { exerciseDetailSheet } from '../sheets.jsx'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { ui } from '../store/useUI.js'
// ^ Adjust this import to whatever sheets.jsx actually uses to open a sheet
// (found in Task 4 Step 3) — replace the placeholder `openMuscleSheet` call
// below with that real mechanism before this task is considered done.

export function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const CAMERA_POSITION = [0, 0.8, 3.8]
const CAMERA_TARGET = [0, 0.8, 0]

function openMuscleExercisesSheet(muscleKey, close) {
  const list = exercisesTargeting(muscleKey)
  ui().openSheet(sheetClose => (
    <>
      <h3>{muscleLabel(muscleKey)}</h3>
      <div className="small muted" style={{ marginBottom: 10 }}>
        {t('{0} exercises target this muscle', list.length)}
      </div>
      <div className="list">
        {list.slice(0, 30).map(ex => (
          <div key={ex.id} className="item" onClick={() => { sheetClose(); exerciseDetailSheet(ex) }}>
            <div className="grow">
              <div className="tt capitalize">{ex.n}</div>
              <div className="ss">{ex.exercise_muscles[muscleKey]}%</div>
            </div>
            <Icon name="chevronRight" className="chev" />
          </div>
        ))}
        {list.length === 0 && <div className="empty">{t('No exercises found for this muscle.')}</div>}
      </div>
    </>
  ))
}

export default function AnatomyView() {
  const nav = useNavigate()
  const location = useLocation()
  const sex = useStore(s => s.S.nutrition.sex)
  const modelUrl = sex === 'female' ? '/models/female.glb' : '/models/male.glb'

  // Task 6 passes the exercise's own `exercise_muscles` object directly
  // ({ [muscleCode]: pct }) — this is exactly the shape AnatomyModel's `heatmap`
  // prop expects (it looks up `heatmap[muscleKeyForMesh(mesh.name)]` per mesh),
  // so no translation is needed here.
  const heatmap = location.state?.muscles ?? null

  const [webglOk] = useState(hasWebGL)

  if (!webglOk) {
    return (
      <div className="empty" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Icon name="info" />
        <div>{t('3D view is not available on this device.')}</div>
        <button className="btn" onClick={() => nav(-1)}>{t('Go back')}</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <button className="iconbtn" style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }} onClick={() => nav(-1)} aria-label={t('Back')}>
        <Icon name="chevronLeft" />
      </button>
      <Canvas
        camera={{ position: CAMERA_POSITION, fov: 36, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', display: 'block', background: '#131519' }}
      >
        <hemisphereLight skyColor="#ffe4cc" groundColor="#1a0000" intensity={0.65} />
        <directionalLight position={[3, 8, 6]} intensity={1.8} />
        <directionalLight position={[-4, 3, -2]} intensity={0.45} color="#ffaa88" />
        <directionalLight position={[-2, 5, -6]} intensity={0.5} color="#aaccff" />
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          panSpeed={0.8}
          rotateSpeed={0.8}
          zoomSpeed={1.2}
          minDistance={1.5}
          maxDistance={12}
          target={CAMERA_TARGET}
        />
        <Suspense fallback={null}>
          <AnatomyModel
            modelUrl={modelUrl}
            heatmap={heatmap}
            onMuscleClick={muscleKey => openMuscleExercisesSheet(muscleKey)}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

**Note for the implementer:** the `ui()` import and `openSheet` call above are a best guess at the pattern — Task 4 Step 3 asks you to confirm the exact mechanism `sheets.jsx` actually exports before finalizing this file. If the real signature differs (e.g. a different import path, or `openSheet` taking different arguments), adjust `openMuscleExercisesSheet` to match it exactly — the visual output (a sheet titled with the muscle's French label, listing exercises with their activation %, each row navigating to `exerciseDetailSheet`) is the actual requirement, not the specific helper name written here.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/views/AnatomyView.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full suite and build**

Run: `cd frontend && npx vitest run && npx vite build`
Expected: full suite green, build succeeds (this file still isn't routed yet, so this only confirms no syntax/import errors)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/AnatomyView.jsx frontend/src/views/AnatomyView.test.js
git commit -m "feat: add AnatomyView page (3D canvas, WebGL fallback, muscle-click sheet)"
```

---

### Task 5: Route, lazy-loading, and a 3D-view icon

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Icon.jsx`

**Interfaces:**
- Consumes: `AnatomyView` (Task 4, via dynamic `import()`).
- Produces: route `/anatomy` reachable via `useNavigate()`; new `Icon name="cube"`. Consumed by Task 6 and Task 7.

- [ ] **Step 1: Add the `cube` icon**

In `frontend/src/components/Icon.jsx`, find the `P` object (the icon path registry — see the existing entries like `dumbbell`, `barbell` for the exact format) and add, in the `/* ---- training ---- */` group or wherever fits the existing grouping comments:

```js
cube: <><path d="M12 4 20 8 12 12 4 8Z" /><path d="M4 8v8l8 4v-8" /><path d="M20 8v8l-8 4" /></>,
```

- [ ] **Step 2: Add the lazy-loaded route**

In `frontend/src/App.jsx`, find the top-of-file imports of view components (e.g. `import Library from './views/Library.jsx'`) and the `<Routes>` block (around line 74-88 per the current file). Add:

```jsx
import { lazy, Suspense } from 'react'
// (add to whatever import block already exists at the top — react-router-dom's
// useNavigate/useLocation etc. are already imported there per the current file)

const AnatomyView = lazy(() => import('./views/AnatomyView.jsx'))
```

Then add the route inside the existing `<Routes>` block, alongside the others:

```jsx
<Route path="/anatomy" element={<Suspense fallback={<div className="empty">{t('Loading…')}</div>}><AnatomyView /></Suspense>} />
```

- [ ] **Step 3: Verify the build still succeeds and creates a separate chunk**

Run: `cd frontend && npx vite build`
Expected: build succeeds; in the output file-size listing, confirm a new chunk appears containing `three`/`AnatomyView` (its name will include a hash, e.g. `AnatomyView-XXXXX.js` or similar — look for a new entry that wasn't in the previous build's listing, roughly 5-10 MB, separate from `index-*.js`). Also confirm `index-*.js`'s size is unchanged from before this task (± the one new `cube` icon path, negligible).

- [ ] **Step 4: Manual smoke check**

Run: `cd frontend && npm run dev`, navigate the browser to `#/anatomy` directly (e.g. `http://localhost:5173/#/anatomy`), confirm the 3D body loads and can be rotated/zoomed with no console errors. This is the first point in the plan where the whole chain (route → lazy import → Canvas → AnatomyModel → GLB load) is exercised end to end.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/Icon.jsx
git commit -m "feat: wire /anatomy route with lazy loading and a cube icon"
```

---

### Task 6: "View in 3D" entry point from the exercise detail sheet

**Files:**
- Modify: `frontend/src/sheets.jsx`

**Interfaces:**
- Consumes: `meshesForMuscles` (Task 2), the `/anatomy` route (Task 5).
- Produces: no new exports — a UI addition to the existing `ExerciseDetail` component.

- [ ] **Step 1: Read the current muscle-activation section**

In `frontend/src/sheets.jsx`, find `ExerciseDetail` (search for `function ExerciseDetail`) and its `MuscleActivation` rendering (search for `<MuscleActivation`). Note the exact surrounding JSX before editing — you're inserting a button next to this section, not replacing anything.

- [ ] **Step 2: Add the import and the button**

Add to the top-of-file imports:

```js
import { useNavigate } from 'react-router-dom'
```

(Check first whether `useNavigate` is already imported in this file for another purpose — if so, don't duplicate the import, just reuse it. No import from `anatomy3d.js` is needed here — see below.)

Inside `ExerciseDetail`, add a `nav = useNavigate()` call alongside the component's other hook calls (same rule as above — reuse an existing `useNavigate()` call in this component if one is already there instead of adding a second one). Then, immediately after the `<MuscleActivation muscles={muscles} />` line found in Step 1, add:

```jsx
{Object.keys(muscles).length > 0 && (
  <button
    className="btn tinted sm"
    style={{ marginTop: 8 }}
    onClick={() => nav('/anatomy', { state: { muscles } })}
  >
    <Icon name="cube" /> {t('View in 3D')}
  </button>
)}
```

(`muscles` here is the same `ex.exercise_muscles || {}` local variable `ExerciseDetail` already computes for `MuscleActivation` — confirm the exact variable name at the point you're editing and use that, not a new lookup. It's passed straight through as `location.state.muscles`, already in the `{ [muscleCode]: pct }` shape `AnatomyView`/`AnatomyModel` expect — Task 2's `meshesForMuscles` is not used on this path; it stays available for a future consumer that needs mesh names instead of muscle codes.)

- [ ] **Step 3: Add the French locale string**

In `frontend/src/locales/fr.js`, add (following the file's existing key→translation format, found near other short UI labels):

```js
'View in 3D': 'Voir en 3D',
```

- [ ] **Step 4: Run the full suite**

Run: `cd frontend && npx vitest run`
Expected: still green, no regressions (this is a JSX-only addition with a pure-function call already tested in Task 2).

- [ ] **Step 5: Manual smoke check**

Run: `cd frontend && npm run dev`, open any exercise's detail sheet that has muscle data, confirm the "Voir en 3D" button appears below the muscle activation bars, and clicking it navigates to `/anatomy` with the correct muscles highlighted (visually compare: the exercise's dominant muscle should appear red/orange on the 3D model, matching the top bar in `MuscleActivation`). Also open a residual cardio exercise (no `exercise_muscles`) and confirm the button does NOT appear.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/sheets.jsx frontend/src/locales/fr.js
git commit -m "feat: add \"View in 3D\" entry point from the exercise detail sheet"
```

---

### Task 7: Direct entry point for free exploration

**Files:**
- Modify: `frontend/src/views/Settings.jsx` (or wherever the app's main navigation/menu list lives — locate the exact file first)

**Interfaces:**
- Consumes: the `/anatomy` route (Task 5).
- Produces: no new exports — a UI addition to an existing menu/list view.

- [ ] **Step 1: Locate the right insertion point**

Run: `grep -n "Row\|lrow" frontend/src/views/Settings.jsx | head -20` to find the existing pattern for a tappable menu row in this view (Settings is the most likely home for "Explorer l'anatomie" per the spec, but if OpenGym has a more fitting top-level menu — e.g. a tab bar or a dedicated "More" screen — use that instead; check `App.jsx`'s route list from Task 5 Step 2 for context on what's a top-level screen versus a sub-screen).

- [ ] **Step 2: Add the entry point**

Using whatever row/list-item pattern Step 1 found (likely the same `Row`/`lrow`-based pattern used throughout the app's settings, per the codebase's established `components/ui.jsx` conventions), add a row that navigates to `/anatomy` with no state:

```jsx
<div className="item" onClick={() => nav('/anatomy')}>
  <span className="lrow-i"><Icon name="cube" /></span>
  <div className="grow">
    <div className="tt">{t('Explore anatomy')}</div>
    <div className="ss">{t('3D body, muscles and matching exercises')}</div>
  </div>
  <Icon name="chevronRight" className="chev" />
</div>
```

(Adjust the exact class names to match whatever the surrounding rows in this file actually use — copy a neighboring row's structure rather than inventing new markup.)

- [ ] **Step 3: Add the locale strings**

In `frontend/src/locales/fr.js`:

```js
'Explore anatomy': 'Explorer l\'anatomie',
'3D body, muscles and matching exercises': 'Corps en 3D, muscles et exercices associés',
```

- [ ] **Step 4: Run the full suite and manual check**

Run: `cd frontend && npx vitest run` (still green), then `npm run dev` and confirm the new entry point navigates to `/anatomy` with the body shown neutral (no heatmap), and that clicking any muscle opens the exercises-targeting sheet from Task 4.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Settings.jsx frontend/src/locales/fr.js
git commit -m "feat: add direct entry point to explore the 3D anatomy view"
```

---

### Task 8: Full manual verification pass

**Files:** none (verification only)

**Interfaces:** n/a

- [ ] **Step 1: Automated baseline**

Run: `cd frontend && npx vitest run` — confirm 0 failures across the whole suite (this re-confirms every prior task's automated checks together, plus everything from before this plan).

- [ ] **Step 2: Bundle separation check**

Run: `cd frontend && npx vite build`, inspect the output file-size listing. Confirm: (a) the Three.js/R3F/AnatomyView chunk is separate from `index-*.js`, (b) `index-*.js`'s size is unchanged from the pre-this-plan baseline (check against a build from before Task 1, or just confirm it did not grow by more than a few KB — the `cube` icon path is the only expected addition to that chunk).

- [ ] **Step 3: Heatmap correctness across exercises**

Run: `npm run dev`. Open 3 different exercises from different body parts (e.g. one chest exercise, one back exercise, one leg exercise) and click "Voir en 3D" from each. Confirm: the muscles that light up match what `MuscleActivation`'s bars show for that exercise (same muscles, roughly matching color intensity — red/orange for high %, cooler for low %), and the rest of the body stays a neutral dim/base color.

- [ ] **Step 4: Click-to-exercises round trip**

From the neutral (no-heatmap) 3D view (Task 7's entry point), click at least 3 different muscles across different body regions. Confirm each opens a sheet listing real OpenGym exercises, sorted with the highest-activation exercise first, and that clicking an exercise in that list opens its normal detail sheet.

- [ ] **Step 5: Sex-based model selection**

In Settings, switch the profile's sex between "Homme" and "Femme" (in the nutrition profile screen where `n.sex` is set, per `Profile.jsx`), reopen `/anatomy` after each change, confirm the correct model (`male.glb` vs `female.glb`) loads each time. Also test with sex unset (a fresh profile) — confirm it falls back to `male.glb` without error.

- [ ] **Step 6: WebGL fallback**

Simulate WebGL being unavailable (e.g. via your browser's flags to disable WebGL, or by temporarily editing `hasWebGL()` to always return `false` and reverting after the check) and confirm the fallback message renders instead of a blank canvas or a crash, with a working "back" button.

- [ ] **Step 7: No console errors**

Across all the manual checks above, confirm the browser console shows no errors (warnings from Three.js about texture sizes or similar are acceptable; thrown exceptions or React errors are not).

- [ ] **Step 8: Final commit**

```bash
cd "/path/to/openGym"
git add -A
git commit -m "chore: final verification pass for 3D anatomy view MVP" --allow-empty
```

(Use `--allow-empty` since this task is verification-only and may have nothing new to stage — only omit it if Step 1-7 turned up something you fixed inline, in which case commit that fix normally instead.)

## Self-Review Notes

- **Spec coverage:** lazy loading (Task 5), MVP scope only / no phase-2 features (Tasks 3-4 explicitly cut layer-switching/isolation/ghost-bones/split-view), model by profile sex (Task 4/8), web-first with WebGL fallback (Task 4/8), vendored architecture (Task 1), bidirectional linking both directions (Task 6 for exercise→3D, Task 4's click handler + Task 2's `exercisesTargeting` for 3D→exercise list), `exercises-by-muscle.json`/`muscles-index.json` NOT ported (confirmed — Task 2 computes from `EXDB` instead).
- **Known open item carried into Task 4:** the exact sheet-opening call (`ui().openSheet(...)` vs. whatever `sheets.jsx` actually exports) is a best guess pending Task 4 Step 3's read of the real file — flagged explicitly in that task rather than silently assumed, since guessing wrong here would be a runtime error, not a design ambiguity.
- **Type/shape consistency:** `AnatomyModel`'s `heatmap` prop (Task 3) is keyed by muscle code (`{ [muscleCode]: pct }`, read via `muscleKeyForMesh` per rendered mesh). Task 6 passes the exercise's own `exercise_muscles` object straight through `location.state.muscles`, already in that exact shape — no translation needed in `AnatomyView` (Task 4). `meshesForMuscles` (Task 2) is built and tested but not consumed by this call path; it's kept for a future consumer that needs mesh names rather than muscle codes (e.g. a phase-2 isolation mode) — a documented, deliberate YAGNI call, not dead code left by accident.
- **Review Focus:** all five items map to explicit test cases (Task 2's zero-value and unknown-key tests, Task 6's residual-cardio-exercise check, Task 4/8's WebGL and unset-sex checks).
