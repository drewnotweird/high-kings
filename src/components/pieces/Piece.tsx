import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
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

  const color = isKing
    ? theme.kingColor
    : isDefender
    ? theme.defenderColor
    : theme.attackerColor

  const emissive = isKing
    ? theme.kingEmissive
    : isDefender
    ? theme.defenderEmissive
    : theme.attackerEmissive

  // Lathe profile curves — Vector2(radius, height)
  const points = useMemo(() => {
    if (isKing) {
      return [
        new Vector2(0, 0),
        new Vector2(0.28, 0),
        new Vector2(0.33, 0.10),
        new Vector2(0.28, 0.25),
        new Vector2(0.22, 0.50),
        new Vector2(0.24, 0.72),
        new Vector2(0.20, 0.95),
        new Vector2(0.16, 1.10),
        new Vector2(0.24, 1.20),
        new Vector2(0.24, 1.36),
        new Vector2(0.14, 1.44),
        new Vector2(0.08, 1.48),
        new Vector2(0, 1.48),
      ]
    }
    if (isDefender) {
      return [
        new Vector2(0, 0),
        new Vector2(0.24, 0),
        new Vector2(0.28, 0.10),
        new Vector2(0.22, 0.28),
        new Vector2(0.20, 0.52),
        new Vector2(0.22, 0.72),
        new Vector2(0.18, 0.88),
        new Vector2(0.12, 0.96),
        new Vector2(0, 0.96),
      ]
    }
    // Attacker — squat but still taller than before
    return [
      new Vector2(0, 0),
      new Vector2(0.27, 0),
      new Vector2(0.31, 0.10),
      new Vector2(0.27, 0.24),
      new Vector2(0.24, 0.48),
      new Vector2(0.20, 0.68),
      new Vector2(0.14, 0.76),
      new Vector2(0, 0.76),
    ]
  }, [isKing, isDefender])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const targetY = isSelected ? 0.55 : 0.15
    meshRef.current.position.y +=
      (targetY - meshRef.current.position.y) * Math.min(delta * 8, 1)
    if (isKing) {
      meshRef.current.rotation.y += delta * 0.3
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[x, 0.15, z]}
      castShadow
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <latheGeometry args={[points, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={isSelected ? 1.5 : 0.4}
        roughness={theme.pieceRoughness}
        metalness={theme.pieceMetalness}
      />
    </mesh>
  )
}
