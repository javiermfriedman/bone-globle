import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { slugByMeshName } from '../data/catalog'

export const SKELETON_URL = '/models/skeleton.glb'

/** three's GLTFLoader runs every node name through PropertyBinding.sanitizeNodeName. */
export const sanitizeNodeName = (name: string): string =>
  THREE.PropertyBinding.sanitizeNodeName(name)

const slugBySanitizedName = new Map<string, string>(
  [...slugByMeshName].map(([mesh, slug]) => [sanitizeNodeName(mesh), slug]),
)

/** slug -> CSS color for every currently highlighted bone. */
export type BoneColors = Record<string, string>

const BASE_MATERIAL = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#d8d3c4'),
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  roughness: 0.85,
  metalness: 0,
  side: THREE.FrontSide,
})

function makeHighlightMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.35,
    roughness: 0.55,
    metalness: 0,
  })
}

export interface SkeletonHandle {
  /** mesh node name -> mesh */
  meshes: Map<string, THREE.Mesh>
  /** slug -> meshes belonging to that catalog entry */
  meshesBySlug: Map<string, THREE.Mesh[]>
}

interface Props {
  colors: BoneColors
  onReady?: (handle: SkeletonHandle) => void
}

export function Skeleton({ colors, onReady }: Props) {
  const gltf = useGLTF(SKELETON_URL)

  const handle = useMemo<SkeletonHandle>(() => {
    const meshes = new Map<string, THREE.Mesh>()
    const meshesBySlug = new Map<string, THREE.Mesh[]>()
    gltf.scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return
      const mesh = obj as THREE.Mesh
      // Node name lives on the mesh itself, or on its parent when the loader wraps it.
      // GLTFLoader sanitizes node names ("Left femur" -> "Left_femur"), so look the
      // catalog up through the same transform.
      const name = mesh.name || mesh.parent?.name || ''
      meshes.set(name, mesh)
      mesh.material = BASE_MATERIAL
      mesh.renderOrder = 0
      const slug = slugBySanitizedName.get(name)
      if (slug) {
        const list = meshesBySlug.get(slug) ?? []
        list.push(mesh)
        meshesBySlug.set(slug, list)
      }
    })
    return { meshes, meshesBySlug }
  }, [gltf])

  useEffect(() => {
    onReady?.(handle)
  }, [handle, onReady])

  // Apply colors: highlighted meshes get an opaque material, everything else the shared base.
  useEffect(() => {
    const created: THREE.Material[] = []
    for (const mesh of handle.meshes.values()) {
      if (mesh.material !== BASE_MATERIAL) {
        mesh.material = BASE_MATERIAL
        mesh.renderOrder = 0
      }
    }
    for (const [slug, color] of Object.entries(colors)) {
      const list = handle.meshesBySlug.get(slug)
      if (!list) continue
      const mat = makeHighlightMaterial(color)
      created.push(mat)
      for (const mesh of list) {
        mesh.material = mat
        mesh.renderOrder = 1
      }
    }
    return () => created.forEach((m) => m.dispose())
  }, [colors, handle])

  return <primitive object={gltf.scene} />
}

useGLTF.preload(SKELETON_URL)
