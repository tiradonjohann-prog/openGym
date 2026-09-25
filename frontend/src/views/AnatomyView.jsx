// frontend/src/views/AnatomyView.jsx
import { Suspense, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { AnatomyModel } from '../components/anatomy3d/AnatomyModel.jsx'
import { exercisesTargeting } from '../lib/anatomy3d.js'
import { muscleLabel } from '../lib/exerciseLabels.js'
import { exerciseDetailSheet } from '../sheets.jsx'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'

// Same helper sheets.jsx keeps locally (`const ui = () => useUI.getState()`) — the
// real mechanism every sheet in the app uses is `useUI.getState().openSheet(render, opts)`.
// `openSheet` is not itself exported from useUI.js, so callers grab the store's
// current state and call the method on it, exactly like sheets.jsx does.
const ui = () => useUI.getState()

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

function openMuscleExercisesSheet(muscleKey) {
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

  // The caller (Task 6) passes the exercise's own `exercise_muscles` object directly
  // ({ [muscleCode]: pct }) — this is exactly the shape AnatomyModel's `heatmap` prop
  // expects (it looks up `heatmap[muscleKeyForMesh(mesh.name)]` per mesh), so no
  // translation step happens here.
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
