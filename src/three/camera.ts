import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export interface FlyTarget {
  center: THREE.Vector3
  radius: number
}

/** Bounding sphere of a set of meshes in world space. */
export function boundsOf(meshes: THREE.Mesh[]): FlyTarget {
  const box = new THREE.Box3()
  for (const m of meshes) box.expandByObject(m)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const sphere = new THREE.Sphere()
  box.getBoundingSphere(sphere)
  return { center, radius: Math.max(sphere.radius, 0.02) }
}

/**
 * For paired bones, frame only the side closest to the camera. Meshes are grouped by the
 * sign of their x centre so multi-part bones (sternum) still stay together.
 */
export function nearestSide(meshes: THREE.Mesh[], from: THREE.Vector3): THREE.Mesh[] {
  if (meshes.length < 2) return meshes
  const centre = (m: THREE.Mesh) => {
    const box = new THREE.Box3().expandByObject(m)
    return box.getCenter(new THREE.Vector3())
  }
  const groups: { left: THREE.Mesh[]; right: THREE.Mesh[] } = { left: [], right: [] }
  for (const m of meshes) (centre(m).x < 0 ? groups.left : groups.right).push(m)
  if (!groups.left.length || !groups.right.length) return meshes
  const dist = (g: THREE.Mesh[]) => boundsOf(g).center.distanceTo(from)
  return dist(groups.left) <= dist(groups.right) ? groups.left : groups.right
}

export interface FlyAnimation {
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  start: number
  duration: number
}

/** Plan a fly-to so the sphere fills ~60% of the vertical FOV, approaching from the current direction. */
export function planFlyTo(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl,
  target: FlyTarget,
  now: number,
  duration = 900,
): FlyAnimation {
  const fovRad = THREE.MathUtils.degToRad(camera.fov)
  const dist = (target.radius / Math.sin(fovRad / 2)) * 1.6
  const dir = camera.position.clone().sub(controls.target).normalize()
  if (dir.lengthSq() === 0) dir.set(0, 0, 1)
  const toPos = target.center.clone().add(dir.multiplyScalar(dist))
  return {
    fromPos: camera.position.clone(),
    toPos,
    fromTarget: controls.target.clone(),
    toTarget: target.center.clone(),
    start: now,
    duration,
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** Advance an animation; returns true when finished. */
export function stepFly(
  anim: FlyAnimation,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl,
  now: number,
): boolean {
  const t = Math.min(1, (now - anim.start) / anim.duration)
  const k = easeInOut(t)
  camera.position.lerpVectors(anim.fromPos, anim.toPos, k)
  controls.target.lerpVectors(anim.fromTarget, anim.toTarget, k)
  controls.update()
  return t >= 1
}

export const HOME_POSITION: [number, number, number] = [0, 0.15, 2.6]
export const HOME_TARGET: [number, number, number] = [0, 0, 0]
