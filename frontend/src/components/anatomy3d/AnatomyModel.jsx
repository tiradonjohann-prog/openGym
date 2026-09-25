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

// Fascia and other connective-tissue sheets wrap directly over the muscle
// surface in this GLB. Their mesh names never match BONE/LIGAMENT/ORGAN/SKIN_WORDS
// (fascia isn't a ligament), so they used to fall through to the 'muscles'
// default layer and render as an opaque, featureless shell hiding the
// actual (detailed, clickable) muscle mesh underneath — the same list
// already used to disable clicks on them below.
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

function getMeshLayer(mesh) {
  if (isNonClickable(mesh.name)) return 'connective'
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

// ─── Materials ────────────────────────────────────────────────────────────────

let _muscleMat = null
function muscleMat() {
  if (!_muscleMat) {
    _muscleMat = new THREE.MeshPhysicalMaterial({
      color: '#D98BA0', roughness: 0.72, metalness: 0.0,
      sheen: 0.5, sheenRoughness: 0.75, sheenColor: new THREE.Color('#FFC2D6'),
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

// Skeleton shown faintly through the muscle layer for anatomical context —
// low opacity, no depth write so it never fights the opaque muscles for
// z-order (it should always read as "behind" them).
const BONE_MAT = new THREE.MeshStandardMaterial({
  color: '#ECE4D0', roughness: 0.55, metalness: 0.05,
  transparent: true, opacity: 0.65, depthWrite: false,
})

// Applied to whichever muscle the user last clicked, regardless of heatmap
// state — takes priority over the heatmap/default coloring so a click's
// result is always visible.
let _selectedMat = null
function selectedMat() {
  if (!_selectedMat) {
    _selectedMat = new THREE.MeshPhysicalMaterial({
      color: '#B85858', roughness: 0.48, metalness: 0.0,
      sheen: 0.4, sheenRoughness: 0.7, sheenColor: new THREE.Color('#FF9090'),
      clearcoat: 0.18, clearcoatRoughness: 0.55,
      emissive: new THREE.Color('#5A1010'), emissiveIntensity: 0.3,
    })
  }
  return _selectedMat
}

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

function ModelContent({ modelUrl, heatmap, selectedMuscleKey, onMuscleClick }) {
  const { scene } = useGLTF(modelUrl)
  const groupRef = useRef()
  const [ready, setReady] = useState(false)

  const meshes = useMemo(() => {
    const acc = []
    scene.traverse(obj => {
      if (!obj.isMesh) return
      obj.userData.layer = getMeshLayer(obj)
      obj.userData.clickable = obj.userData.layer === 'muscles' && !isNonClickable(obj.name)
      if (!obj.userData.clickable) obj.raycast = () => {}
      acc.push(obj)
    })
    return acc
  }, [scene])

  useEffect(() => {
    const hasHeatmap = heatmap && Object.keys(heatmap).length > 0
    for (const mesh of meshes) {
      if (mesh.userData.layer === 'bones') {
        mesh.visible = true
        mesh.material = BONE_MAT
        continue
      }
      if (mesh.userData.layer !== 'muscles') {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      const key = muscleKeyForMesh(mesh.name)
      if (selectedMuscleKey && key === selectedMuscleKey) {
        mesh.material = selectedMat()
        continue
      }
      if (!hasHeatmap) {
        mesh.material = muscleMat()
        continue
      }
      const pct = key ? (heatmap[key] ?? 0) : 0
      mesh.material = pct > 0 ? heatmapMat(pct) : DIM_MAT
    }
    setReady(true)
  }, [meshes, heatmap, selectedMuscleKey])

  function handleClick(e) {
    e.stopPropagation()
    if (dragGuard.wasDrag) return
    const mesh = e.object
    if (!mesh?.isMesh) return
    if (mesh.userData.layer !== 'muscles' || !mesh.userData.clickable) return
    const key = muscleKeyForMesh(mesh.name)
    if (key) onMuscleClick(key, mesh)
  }

  return (
    <group ref={groupRef} onClick={handleClick} visible={ready}>
      <primitive object={scene} />
    </group>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export function AnatomyModel({ modelUrl, heatmap, selectedMuscleKey, onMuscleClick }) {
  return (
    <ModelErrorBoundary fallback={<FallbackMesh />}>
      <ModelContent modelUrl={modelUrl} heatmap={heatmap} selectedMuscleKey={selectedMuscleKey} onMuscleClick={onMuscleClick} />
    </ModelErrorBoundary>
  )
}
