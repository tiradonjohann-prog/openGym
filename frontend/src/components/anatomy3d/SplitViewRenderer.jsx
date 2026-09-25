// frontend/src/components/anatomy3d/SplitViewRenderer.jsx
// Adapted from anatomy-viewer's Viewer3D.jsx split-screen renderer, using
// R3F's built-in take-over-the-render-loop mechanism instead of monkey-
// patching gl.render directly (a positive useFrame priority disables R3F's
// default render call for as long as this component is mounted, and R3F
// resumes it automatically on unmount — no manual restore, no risk of
// leaving the renderer in a broken state if unmount ordering is unlucky).
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'

// Renders the scene twice in the same frame — a front camera on the left
// half of the canvas, a back camera on the right — using viewport/scissor
// per half. Only mounted while split view is active, so it adds no cost in
// the normal orbit mode.
const FOV = 40
// Half-extents (in world units, from the target point) the body must fit
// inside, with some headroom/footroom and shoulder margin — used to pick a
// camera distance that keeps the whole body in frame regardless of the
// half-viewport's aspect ratio.
const BODY_HALF_HEIGHT = 1.15
const BODY_HALF_WIDTH = 0.5

// On a narrow phone-portrait screen, each split half is itself tall and
// narrow (halfWidth = totalWidth/2, full height) — a fixed camera distance
// tuned for a landscape-ish half crops the body's sides. Solving for
// whichever of height/width is the binding constraint at the current
// aspect keeps the full body (both views) in frame on any screen shape.
function distanceToFit(aspect) {
  const halfFovRad = (FOV * Math.PI) / 360
  const tanHalfFov = Math.tan(halfFovRad)
  const distanceForHeight = BODY_HALF_HEIGHT / tanHalfFov
  const distanceForWidth = BODY_HALF_WIDTH / (aspect * tanHalfFov)
  return Math.max(distanceForHeight, distanceForWidth)
}

export function SplitViewRenderer() {
  const frontCam = useMemo(() => new THREE.PerspectiveCamera(FOV, 1, 0.1, 100), [])
  const backCam = useMemo(() => new THREE.PerspectiveCamera(FOV, 1, 0.1, 100), [])

  useFrame(({ gl, scene }) => {
    const canvas = gl.domElement
    const w = canvas.width
    const h = canvas.height
    const halfW = Math.floor(w / 2)
    const aspect = halfW / h
    const distance = distanceToFit(aspect)

    frontCam.aspect = aspect
    frontCam.position.set(0, 0.8, distance)
    frontCam.lookAt(0, 0.8, 0)
    frontCam.updateProjectionMatrix()

    backCam.aspect = aspect
    backCam.position.set(0, 0.8, -distance)
    backCam.lookAt(0, 0.8, 0)
    backCam.updateProjectionMatrix()

    gl.autoClear = false
    gl.setScissorTest(true)

    if (scene.background instanceof THREE.Color) {
      gl.setClearColor(scene.background, 1)
    }
    gl.clear(true, true, false)

    // Front (left half)
    gl.setViewport(0, 0, halfW, h)
    gl.setScissor(0, 0, halfW, h)
    gl.clearDepth()
    gl.render(scene, frontCam)

    // Back (right half)
    gl.setViewport(halfW, 0, halfW, h)
    gl.setScissor(halfW, 0, halfW, h)
    gl.clearDepth()
    gl.render(scene, backCam)

    gl.setScissorTest(false)
    gl.setViewport(0, 0, w, h)
    gl.autoClear = true
  }, 1)

  return null
}
