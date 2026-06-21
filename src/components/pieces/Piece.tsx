import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Mesh, Vector2 } from 'three'
import type { Piece as PieceData } from '../../game/hnefatafl'
import type { ThemeConfig } from '../../lib/themes'

const BOARD_OFFSET = 5

interface PieceProps {
  piece: PieceData
  theme: ThemeConfig
  isSelected: boolean
  onClick: () => void
}

export function Piece({ piece, theme, isSelected, onClick }: PieceProps) {
  const meshRef = useRef<Mesh>(null)

  const x = piece.col - BOARD_OFFSET
  const z = piece.row - BOARD_OFFSET

  const isKing = piece.type === 'king'
  const isDefender = piece.type === 'defender'

  const emissive = isKing
    ? theme.kingEmissive
    : isDefender
    ? theme.defenderEmissive
    : theme.attackerEmissive

  const prefix = isKing ? 'piece-king' : isDefender ? 'piece-light' : 'piece-dark'
  const [texture, roughnessMap] = useTexture([
    `/textures/${prefix}.png`,
    `/textures/${prefix}-roughness.png`,
  ])

  const points = useMemo(() => {
    if (isKing) {
      // Tall, wide base, gentle taper, generous dome
      return [
        new Vector2(0,    0   ),
        new Vector2(0.38, 0   ),
        new Vector2(0.40, 0.06),
        new Vector2(0.35, 0.20),
        new Vector2(0.31, 0.70),
        new Vector2(0.29, 1.00),
        new Vector2(0.26, 1.20),
        new Vector2(0.19, 1.34),
        new Vector2(0.09, 1.41),
        new Vector2(0,    1.43),
      ]
    }
    if (isDefender) {
      // Medium height, slimmer than king
      return [
        new Vector2(0,    0   ),
        new Vector2(0.26, 0   ),
        new Vector2(0.28, 0.05),
        new Vector2(0.23, 0.16),
        new Vector2(0.20, 0.55),
        new Vector2(0.18, 0.72),
        new Vector2(0.14, 0.83),
        new Vector2(0.07, 0.90),
        new Vector2(0,    0.92),
      ]
    }
    // Attacker — stockier, slightly shorter than defender
    return [
      new Vector2(0,    0   ),
      new Vector2(0.28, 0   ),
      new Vector2(0.30, 0.05),
      new Vector2(0.25, 0.15),
      new Vector2(0.22, 0.48),
      new Vector2(0.19, 0.63),
      new Vector2(0.14, 0.73),
      new Vector2(0.06, 0.78),
      new Vector2(0,    0.80),
    ]
  }, [isKing, isDefender])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const targetY = isSelected ? 0.55 : 0.15
    meshRef.current.position.y +=
      (targetY - meshRef.current.position.y) * Math.min(delta * 8, 1)
  })

  return (
    <mesh
      ref={meshRef}
      position={[x, 0.15, z]}
      rotation={[0, Math.PI, 0]}
      castShadow
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <latheGeometry args={[points, 32]} />
      <meshPhysicalMaterial
        map={texture}
        bumpMap={texture}
        bumpScale={0.04}
        roughnessMap={roughnessMap}
        roughness={1.0}
        emissive={emissive}
        emissiveIntensity={isSelected ? 0.6 : 0.12}
        metalness={0.0}
        clearcoat={1}
        clearcoatRoughness={0.22}
      />
    </mesh>
  )
}
