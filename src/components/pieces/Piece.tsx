import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Mesh, Vector2 } from 'three'
import type { Piece as PieceData } from '../../game/hnefatafl'
import type { ThemeConfig } from '../../lib/themes'

const BOARD_OFFSET = 5
const W = 1.35
const DROP_FROM = 18
const REST_Y = 0.15

interface PieceProps {
  piece: PieceData
  theme: ThemeConfig
  isSelected: boolean
  dropDelay: number  // seconds before this piece starts falling
  onClick: () => void
}

export function Piece({ piece, theme: _theme, isSelected, dropDelay, onClick }: PieceProps) {
  const meshRef = useRef<Mesh>(null)
  const landed = useRef(false)

  const x = piece.col - BOARD_OFFSET
  const z = piece.row - BOARD_OFFSET

  const isKing = piece.type === 'king'
  const isDefender = piece.type === 'defender'

  const prefix = isKing ? 'piece-king' : isDefender ? 'piece-light' : 'piece-dark'
  const texture = useTexture(`${import.meta.env.BASE_URL}textures/${prefix}.png`)
  const roughnessMap = useTexture(`${import.meta.env.BASE_URL}textures/${prefix}-roughness.png`)

  const points = useMemo(() => {
    if (isKing) {
      return [
        new Vector2(0,        0   ),
        new Vector2(0.38*W,   0   ),
        new Vector2(0.40*W,   0.06),
        new Vector2(0.35*W,   0.20),
        new Vector2(0.31*W,   0.70),
        new Vector2(0.29*W,   1.00),
        new Vector2(0.26*W,   1.20),
        new Vector2(0.19*W,   1.34),
        new Vector2(0.09*W,   1.41),
        new Vector2(0,        1.43),
      ]
    }
    if (isDefender) {
      return [
        new Vector2(0,        0   ),
        new Vector2(0.26*W,   0   ),
        new Vector2(0.28*W,   0.05),
        new Vector2(0.23*W,   0.16),
        new Vector2(0.20*W,   0.55),
        new Vector2(0.18*W,   0.72),
        new Vector2(0.14*W,   0.83),
        new Vector2(0.07*W,   0.90),
        new Vector2(0,        0.92),
      ]
    }
    return [
      new Vector2(0,        0   ),
      new Vector2(0.28*W,   0   ),
      new Vector2(0.30*W,   0.05),
      new Vector2(0.25*W,   0.15),
      new Vector2(0.22*W,   0.48),
      new Vector2(0.19*W,   0.63),
      new Vector2(0.14*W,   0.73),
      new Vector2(0.06*W,   0.78),
      new Vector2(0,        0.80),
    ]
  }, [isKing, isDefender])

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()

    if (!landed.current) {
      if (t < dropDelay) {
        meshRef.current.position.y = DROP_FROM
        return
      }
      // Fast drop with slight overshoot bounce
      const progress = Math.min((t - dropDelay) / 0.35, 1)
      const eased = progress < 1
        ? 1 - Math.pow(1 - progress, 3)  // ease-out cubic
        : 1
      // Small bounce overshoot
      const bounce = progress > 0.85
        ? Math.sin((progress - 0.85) / 0.15 * Math.PI) * -0.12
        : 0
      meshRef.current.position.y = DROP_FROM + (REST_Y - DROP_FROM) * eased + bounce

      if (progress >= 1) landed.current = true
      return
    }

    // Normal select/deselect animation once landed
    const targetY = isSelected ? 0.55 : REST_Y
    meshRef.current.position.y +=
      (targetY - meshRef.current.position.y) * Math.min(delta * 8, 1)
  })

  return (
    <mesh
      ref={meshRef}
      position={[x, DROP_FROM, z]}
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
  )
}
