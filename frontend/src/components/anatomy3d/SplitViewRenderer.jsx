// frontend/src/components/anatomy3d/SplitViewRenderer.jsx
// Ported from anatomy-viewer's Viewer3D.jsx split-screen renderer.
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'

// Renders the scene twice in the same frame — a front camera on the left
// half of the canvas, a back camera on the right — by taking over R3F's
// render call and using viewport/scissor per half. Only mounted while split
// view is active, so it adds no cost in the normal orbit mode.
export function SplitViewRenderer() {
  const { gl, scene } = useThree()
  const origRenderRef = useRef(null)

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

  useEffect(() => {
    origRenderRef.current = gl.render.bind(gl)
    gl.render = () => {}
    return () => {
      if (origRenderRef.current) {
        gl.render = origRenderRef.current
        origRenderRef.current = null
      }
    }
  }, [gl])

  useFrame(() => {
    if (!origRenderRef.current) return

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
    origRenderRef.current(scene, frontCam)

    // Back (right half)
    backCam.aspect = halfW / h
    backCam.updateProjectionMatrix()
    gl.setViewport(halfW, 0, halfW, h)
    gl.setScissor(halfW, 0, halfW, h)
    gl.clearDepth()
    origRenderRef.current(scene, backCam)

    gl.setScissorTest(false)
    gl.setViewport(0, 0, w, h)
    gl.autoClear = true
  })

  return null
}
