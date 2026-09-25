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
export function SplitViewRenderer() {
  const frontCam = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    cam.position.set(0, 0.8, 3.5)
    cam.lookAt(0, 0.8, 0)
    return cam
  }, [])

  const backCam = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    cam.position.set(0, 0.8, -3.5)
    cam.lookAt(0, 0.8, 0)
    return cam
  }, [])

  useFrame(({ gl, scene }) => {
    const canvas = gl.domElement
    const w = canvas.width
    const h = canvas.height
    const halfW = Math.floor(w / 2)

    gl.autoClear = false
    gl.setScissorTest(true)

    if (scene.background instanceof THREE.Color) {
      gl.setClearColor(scene.background, 1)
    }
    gl.clear(true, true, false)

    // Front (left half)
    frontCam.aspect = halfW / h
    frontCam.updateProjectionMatrix()
    gl.setViewport(0, 0, halfW, h)
    gl.setScissor(0, 0, halfW, h)
    gl.clearDepth()
    gl.render(scene, frontCam)

    // Back (right half)
    backCam.aspect = halfW / h
    backCam.updateProjectionMatrix()
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
