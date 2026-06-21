import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Mesh, Vector2 } from 'three'
import type { Piece as PieceData } from '../../game/hnefatafl'
import type { ThemeConfig } from '../../lib/themes'

const BOARD_OFFSET = 5

// Shield sits on the front face of each piece.
// Position is in local mesh space: -Z is the camera-facing surface (after PI rotation).
// shieldZ should be slightly past the surface radius at that height.
const SHIELD_DEFS = {
  king:     { y: 0.65, z: -0.37, r: 0.22, thickness: 0.04 },
  defender: { y: 0.44, z: -0.23, r: 0.15, thickness: 0.035 },
  attacker: { y: 0.36, z: -0.28, r: 0.15, thickness: 0.035 },
}

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

  const shieldEmissive = isKing ? '#c8900a' : isDefender ? '#5a3a10' : '#4a0000'

  const prefix = isKing ? 'piece-king' : isDefender ? 'piece-light' : 'piece-dark'
  const [texture, roughnessMap] = useTexture([
    `/textures/${prefix}.png`,
    `/textures/${prefix}-roughness.png`,
  ])

  const shield = isKing ? SHIELD_DEFS.king : isDefender ? SHIELD_DEFS.defender : SHIELD_DEFS.attacker

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
      <latheGeometry args={[points, 24]} />
      <meshPhysicalMaterial
        map={texture}
        bumpMap={texture}
        bumpScale={0.04}
        roughnessMap={roughnessMap}
        roughness={0.55}
        emissive={emissive}
        emissiveIntensity={isSelected ? 0.6 : 0.12}
        metalness={0.0}
        clearcoat={1}
        clearcoatRoughness={0.22}
      />

      {/* Shield disc — child inherits parent rotation, so -Z local = camera-facing */}
      <mesh
        position={[0, shield.y, shield.z]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[shield.r, shield.r, shield.thickness, 40]} />
        <meshPhysicalMaterial
          map={texture}
          roughness={0.5}
          metalness={0.05}
          emissive={shieldEmissive}
          emissiveIntensity={isSelected ? 0.8 : 0.2}
          clearcoat={1}
          clearcoatRoughness={0.15}
        />
      </mesh>

      {/* Shield rim */}
      <mesh
        position={[0, shield.y, shield.z - 0.005]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <torusGeometry args={[shield.r, 0.012, 8, 40]} />
        <meshPhysicalMaterial
          roughness={0.3}
          metalness={0.6}
          emissive={shieldEmissive}
          emissiveIntensity={isSelected ? 1.0 : 0.4}
          clearcoat={1}
          clearcoatRoughness={0.1}
          color={isKing ? '#d4a830' : '#5a4020'}
        />
      </mesh>
    </mesh>
  )
}
