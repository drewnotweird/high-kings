import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import type { Group } from 'three'
import type { Piece as PieceData } from '../../game/hnefatafl'
import type { ThemeConfig } from '../../lib/themes'

const BOARD_OFFSET = 5

interface PieceProps {
  piece: PieceData
  theme: ThemeConfig
  isSelected: boolean
  onClick: () => void
}

export function Piece({ piece, theme: _theme, isSelected, onClick }: PieceProps) {
  const meshRef = useRef<Group>(null)

  const x = piece.col - BOARD_OFFSET
  const z = piece.row - BOARD_OFFSET

  const isKing = piece.type === 'king'
  const isDefender = piece.type === 'defender'

  const prefix = isKing ? 'piece-king' : isDefender ? 'piece-light' : 'piece-dark'
  const texture = useTexture(`/textures/${prefix}.png`)
  const roughnessMap = useTexture(`/textures/${prefix}-roughness.png`)

  // radius, length (cylinder section), capSegments, radialSegments
  const capsule: [number, number, number, number] = isKing
    ? [0.30, 0.55, 8, 24]
    : isDefender
    ? [0.24, 0.30, 8, 24]
    : [0.22, 0.22, 8, 24]

  // Capsule centre sits at y=0; offset so bottom rests on tile surface
  const baseY = 0.094 + capsule[0] + capsule[1] / 2

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const targetY = isSelected ? baseY + 0.45 : baseY
    meshRef.current.position.y +=
      (targetY - meshRef.current.position.y) * Math.min(delta * 8, 1)
  })

  return (
    <group
      ref={meshRef}
      position={[x, baseY, z]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <mesh castShadow>
        <capsuleGeometry args={capsule} />
        <meshPhysicalMaterial
          key={prefix}
          map={texture}
          bumpMap={roughnessMap}
          bumpScale={0.6}
          roughness={0.9}
          metalness={0.0}
          clearcoat={0.0}
          emissiveMap={texture}
          emissive={isKing ? '#c8880a' : isDefender ? '#9a7a40' : '#ffffff'}
          emissiveIntensity={isSelected ? 0.4 : 0.15}
        />
      </mesh>
    </group>
  )
}
