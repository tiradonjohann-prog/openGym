// Camera fly-to helpers for the 3D anatomy view — ported from anatomy-viewer's
// cameraUtils.js, trimmed to just what AnatomyView needs (no multi-preset
// view switching, no flyToMesh-from-scratch variant).
import * as THREE from 'three'

// Only one fly-to animation should ever be driving the camera at a time —
// tracked per controls instance so a second call (e.g. clicking another
// muscle before the first animation finishes) cancels the first instead of
// both fighting over camera.position/controls.target every frame.
const activeAnimations = new WeakMap()

// Smoothly animates the camera position and OrbitControls target from their
// current values to the given ones over `duration` ms (ease-out cubic).
export function lerpCamera(camera, controls, targetPos, targetLookAt, duration = 600) {
  const prevFrame = activeAnimations.get(controls)
  if (prevFrame != null) cancelAnimationFrame(prevFrame)

  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()
  const startTime = performance.now()

  function animate() {
    const t = Math.min((performance.now() - startTime) / duration, 1)
    const ease = 1 - Math.pow(1 - t, 3)

    camera.position.lerpVectors(startPos, targetPos, ease)
    controls.target.lerpVectors(startTarget, targetLookAt, ease)
    controls.update()

    if (t < 1) activeAnimations.set(controls, requestAnimationFrame(animate))
    else activeAnimations.delete(controls)
  }

  animate()
}

// Zooms toward a mesh while keeping the camera's current viewing angle —
// used when a muscle is clicked.
export function focusMesh(camera, controls, mesh) {
  const box = new THREE.Box3().setFromObject(mesh)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const size = box.getSize(new THREE.Vector3()).length()
  const dir = camera.position.clone().sub(controls.target).normalize()
  const distance = Math.max(size * 2.8, 1.2)
  const newPos = center.clone().add(dir.multiplyScalar(distance))
  lerpCamera(camera, controls, newPos, center)
}

// Zooms back out to the default distance/target while keeping the current
// viewing angle — used when a muscle is deselected.
export function dezoom(camera, controls, defaultTarget, defaultDistance) {
  const dir = camera.position.clone().sub(controls.target).normalize()
  const pos = defaultTarget.clone().add(dir.multiplyScalar(defaultDistance))
  lerpCamera(camera, controls, pos, defaultTarget)
}
