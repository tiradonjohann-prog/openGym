// frontend/src/views/AnatomyView.jsx
import { Suspense, useCallback, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store/useStore.js'
import { AnatomyModel, FallbackMesh } from '../components/anatomy3d/AnatomyModel.jsx'
import { exercisesTargeting } from '../lib/anatomy3d.js'
import { muscleLabel } from '../lib/exerciseLabels.js'
import { focusMesh, dezoom } from '../lib/cameraUtils.js'
import { exerciseDetailSheet, confirmSheet } from '../sheets.jsx'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { dragGuard } from '../lib/dragGuard.js'

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
const DEFAULT_DISTANCE = Math.hypot(
  CAMERA_POSITION[0] - CAMERA_TARGET[0],
  CAMERA_POSITION[1] - CAMERA_TARGET[1],
  CAMERA_POSITION[2] - CAMERA_TARGET[2],
)

// Lives inside the Canvas (needs useThree for camera/controls). Animates the
// camera toward the selected mesh, or back out to the default framing when
// nothing is selected — keeping the current viewing angle either way.
function CameraFocusController({ selectedMesh }) {
  const { camera, controls } = useThree()
  const defaultTarget = useRef(new THREE.Vector3(...CAMERA_TARGET)).current

  const prevSelected = useRef(null)
  if (controls && selectedMesh !== prevSelected.current) {
    prevSelected.current = selectedMesh
    if (selectedMesh) focusMesh(camera, controls, selectedMesh)
    else dezoom(camera, controls, defaultTarget, DEFAULT_DISTANCE)
  }

  return null
}

export default function AnatomyView() {
  const nav = useNavigate()
  const location = useLocation()
  const sex = useStore(s => s.S.nutrition.sex)
  const modelUrl = sex === 'female' ? '/models/female.glb' : '/models/male.glb'

  // The caller (exercise detail sheet) passes the exercise's own
  // `exercise_muscles` object directly ({ [muscleCode]: pct }) — this is
  // exactly the shape AnatomyModel's `heatmap` prop expects, no translation.
  const heatmap = location.state?.muscles ?? null

  const [webglOk] = useState(hasWebGL)
  // { muscleKey, mesh } | null — the single source of truth for both the
  // model's highlight color and the side/bottom exercise panel.
  const [selected, setSelected] = useState(null)
  // Once the user picks a muscle outside the exercise's own heatmap (after
  // confirming), the heatmap view is done — free exploration from then on.
  const [heatmapDismissed, setHeatmapDismissed] = useState(false)
  const effectiveHeatmap = heatmapDismissed ? null : heatmap

  const handleMuscleClick = useCallback((muscleKey, mesh) => {
    const inExercise = effectiveHeatmap && (effectiveHeatmap[muscleKey] ?? 0) > 0
    if (effectiveHeatmap && !inExercise) {
      confirmSheet({
        title: t('Leave this exercise?'),
        message: t('This muscle isn’t part of the exercise shown. Selecting it switches to free 3D exploration.'),
        confirmText: t('View this muscle'),
        cancelText: t('Cancel'),
        onConfirm: () => {
          setHeatmapDismissed(true)
          setSelected({ muscleKey, mesh })
        },
      })
      return
    }
    setSelected(prev => (prev?.muscleKey === muscleKey ? null : { muscleKey, mesh }))
  }, [effectiveHeatmap])
  const deselect = useCallback(() => setSelected(null), [])

  if (!webglOk) {
    return (
      <div className="empty" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Icon name="info" />
        <div>{t('3D view is not available on this device.')}</div>
        <button className="btn" onClick={() => nav(-1)}>{t('Go back')}</button>
      </div>
    )
  }

  const list = selected ? exercisesTargeting(selected.muscleKey) : []

  return (
    <div className="anatomy-view">
      <div
        className="anatomy-canvas-wrap"
        onPointerDown={e => dragGuard.start(e.clientX, e.clientY)}
        onPointerMove={e => dragGuard.check(e.clientX, e.clientY)}
      >
        <button className="iconbtn" style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }} onClick={() => nav(-1)} aria-label={t('Back')}>
          <Icon name="chevronLeft" />
        </button>
        <Canvas
          camera={{ position: CAMERA_POSITION, fov: 36, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%', display: 'block', background: '#131519' }}
          onPointerMissed={deselect}
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
          <CameraFocusController selectedMesh={selected?.mesh ?? null} />
          <Suspense fallback={<FallbackMesh />}>
            <AnatomyModel
              modelUrl={modelUrl}
              heatmap={effectiveHeatmap}
              selectedMuscleKey={selected?.muscleKey ?? null}
              onMuscleClick={handleMuscleClick}
            />
          </Suspense>
        </Canvas>
      </div>

      {selected && (
        <div className="anatomy-panel">
          <div className="anatomy-panel-hdr">
            <h3>{muscleLabel(selected.muscleKey)}</h3>
            <button className="iconbtn" onClick={deselect} aria-label={t('Close')}>
              <Icon name="xmark" />
            </button>
          </div>
          <div className="small muted" style={{ marginBottom: 10 }}>
            {list.length > 30
              ? t('Showing top {0} of {1} exercises', Math.min(list.length, 30), list.length)
              : t('{0} exercises target this muscle', list.length)}
          </div>
          <div className="list">
            {list.slice(0, 30).map(ex => (
              <div key={ex.id} className="item" onClick={() => exerciseDetailSheet(ex)}>
                <div className="grow">
                  <div className="tt capitalize">{ex.n}</div>
                  <div className="ss">{ex.exercise_muscles[selected.muscleKey]}%</div>
                </div>
                <Icon name="chevronRight" className="chev" />
              </div>
            ))}
            {list.length === 0 && <div className="empty">{t('No exercises found for this muscle.')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
