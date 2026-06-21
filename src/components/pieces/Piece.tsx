import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, Vector2 } from 'three'
import type { Piece as PieceData } from '../../game/hnefatafl'
import type { ThemeConfig } from '../../lib/themes'
import { buildPieceTextures } from '../../lib/textures'

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

  const textures = useMemo(
    () => buildPieceTextures(isKing ? 'king' : isDefender ? 'light' : 'dark'),
    [isKing, isDefender]
  )

  // Lathe profile curves — Vector2(radius, height)
  const points = useMemo(() => {
    if (isKing) {
      return [
        new Vector2(0, 0),
        new Vector2(0.44, 0),
        new Vector2(0.50, 0.12),
        new Vector2(0.40, 0.32),
        new Vector2(0.34, 0.65),
        new Vector2(0.36, 0.95),
        new Vector2(0.34, 1.15),
        new Vector2(0.30, 1.30),
        new Vector2(0.22, 1.42),
        new Vector2(0.10, 1.48),
        new Vector2(0, 1.50),
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
        map={textures.map}
        roughnessMap={textures.roughnessMap}
        bumpMap={textures.bumpMap}
        bumpScale={0.04}
        emissive={emissive}
        emissiveIntensity={isSelected ? 1.2 : 0.3}
        roughness={theme.pieceRoughness}
        metalness={theme.pieceMetalness}
      />
    </mesh>
  )
}
