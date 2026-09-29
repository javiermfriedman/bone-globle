import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { bySlug } from '../data/catalog'
import { Skeleton, type BoneColors, type SkeletonHandle } from './Skeleton'
import {
  HOME_POSITION,
  HOME_TARGET,
  boundsOf,
  nearestSide,
  planFlyTo,
  stepFly,
  type FlyAnimation,
} from './camera'

interface Props {
  colors: BoneColors
  /** When set, the camera flies to frame these meshes' slug. Changing the value re-triggers. */
  flyToSlug?: string | null
  /** Increment to fly back home. */
  homeToken?: number
}

function CameraRig({
  flyToSlug,
  homeToken,
  handleRef,
  controlsRef,
}: {
  flyToSlug?: string | null
  homeToken?: number
  handleRef: React.MutableRefObject<SkeletonHandle | null>
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const anim = useRef<FlyAnimation | null>(null)

  useEffect(() => {
    if (!flyToSlug || !handleRef.current || !controlsRef.current) return
    const meshes = handleRef.current.meshesBySlug.get(flyToSlug)
    if (!meshes?.length) return
    // Only paired bones split by side: midline groups (a vertebral region, the sternum) have
    // centres a hair either side of x = 0 and must stay whole.
    const framed = bySlug.get(flyToSlug)?.paired ? nearestSide(meshes, camera.position) : meshes
    anim.current = planFlyTo(camera, controlsRef.current, boundsOf(framed), performance.now())
  }, [flyToSlug, camera, handleRef, controlsRef])

  useEffect(() => {
    if (!homeToken || !controlsRef.current) return
    anim.current = {
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...HOME_POSITION),
      fromTarget: controlsRef.current.target.clone(),
      toTarget: new THREE.Vector3(...HOME_TARGET),
      start: performance.now(),
      duration: 700,
    }
  }, [homeToken, camera, controlsRef])

  useFrame(() => {
    if (!anim.current || !controlsRef.current) return
    if (stepFly(anim.current, camera, controlsRef.current, performance.now())) anim.current = null
  })
  return null
}

export function Scene({ colors, flyToSlug, homeToken }: Props) {
  const handleRef = useRef<SkeletonHandle | null>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const [ready, setReady] = useState(false)
  const onReady = useCallback((h: SkeletonHandle) => {
    handleRef.current = h
    setReady(true)
  }, [])

  return (
    <Canvas
      camera={{ position: HOME_POSITION, fov: 40, near: 0.01, far: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => gl.setClearColor('#0f1115')}
    >
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#cfd8ff', '#3a2f22', 0.7]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} />
      <Suspense fallback={null}>
        <Skeleton colors={colors} onReady={onReady} />
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.05}
        maxDistance={8}
        target={HOME_TARGET}
      />
      {ready && (
        <CameraRig
          flyToSlug={flyToSlug}
          homeToken={homeToken}
          handleRef={handleRef}
          controlsRef={controlsRef}
        />
      )}
    </Canvas>
  )
}
