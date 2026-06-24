import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Mesh, Vector2, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { getBoardConfig } from '../../game/hnefatafl'
import type { Piece as PieceData } from '../../game/hnefatafl'
import { useGameStore } from '../../store/gameStore'
import type { ThemeConfig } from '../../lib/themes'
const W = 1.35
const REST_Y = 0.15
const JUMP_PEAK = 1.4
const JUMP_DURATION = 0.36
const CELEBRATE_DURATION = 0.7

export type MenuPhase = 'idle' | 'hiding' | 'hidden' | 'appearing'

interface PieceProps {
  piece: PieceData
  theme: ThemeConfig
  isSelected: boolean
  dropDelay: number
  dropStartMs: number | null
  menuPhase: MenuPhase
  onClick: () => void
}

export function Piece({ piece, theme: _theme, isSelected, dropDelay, dropStartMs, menuPhase, onClick }: PieceProps) {
  const meshRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshPhysicalMaterial>(null)
  const haloRef = useRef<MeshStandardMaterial>(null)
  const landed = useRef(false)
  const landTime = useRef(0)
  const menuOpacity = useRef(1)

  const { rules, powerSaving, captorIds } = useGameStore()
  const boardOffset = (getBoardConfig(rules).boardSize - 1) / 2
  const x = piece.col - boardOffset
  const z = piece.row - boardOffset

  // Animated position — owned entirely by useFrame, never set via JSX prop
  const visualX = useRef(x)
  const visualZ = useRef(z)
  const targetX = useRef(x)
  const targetZ = useRef(z)
  const moveStartX = useRef(x)
  const moveStartZ = useRef(z)
  const moveT = useRef(1)       // 0→1 normalised progress; 1 = arrived
  const moveDuration = useRef(1)
  const moveArc = useRef(0)
  const celebrateT = useRef(0)
  const celebrating = useRef(false)
  const pendingCelebrate = useRef(false)
  const celebrateReadyTime = useRef(0)

  // Queue celebration when this piece is named a captor; useFrame fires it once arrived
  useEffect(() => {
    if (captorIds.includes(piece.id) && !powerSaving) {
      pendingCelebrate.current = true
      // Stationary anvil pieces already have dx≈0, so guard with a minimum wait
      // equal to the shortest possible move duration (0.5s) minus a small margin
      celebrateReadyTime.current = Date.now() + 450
    }
  }, [captorIds])

  useEffect(() => {
    const dx = x - visualX.current
    const dz = z - visualZ.current
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (!powerSaving && dist > 0.05 && landed.current) {
      moveStartX.current = visualX.current
      moveStartZ.current = visualZ.current
      moveDuration.current = Math.max(0.5, dist * 0.28)
      moveT.current = 0
      moveArc.current = Math.min(dist * 0.22, 0.55)
    }
    targetX.current = x
    targetZ.current = z
  }, [x, z])

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
  }, [isKing])

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return

    // useFrame owns position.x and position.z entirely — never set via JSX prop
    meshRef.current.position.x = visualX.current
    meshRef.current.position.z = visualZ.current

    const t = dropStartMs ? (Date.now() - dropStartMs) / 1000 : -1

    // Intro drop (runs once before piece has landed)
    if (!landed.current) {
      if (powerSaving) {
        // Skip drop animation — place instantly
        landed.current = true
        landTime.current = Date.now()
        meshRef.current.visible = true
        meshRef.current.position.y = REST_Y
        meshRef.current.rotation.y = Math.PI
        if (materialRef.current) materialRef.current.opacity = 1
      } else {
        if (t < 0 || t < dropDelay) {
          meshRef.current.visible = false
          meshRef.current.position.y = REST_Y
          meshRef.current.rotation.y = Math.PI + Math.PI * 2
          return
        }
        menuOpacity.current = 1
        if (materialRef.current) materialRef.current.opacity = 1
        meshRef.current.visible = true
        const progress = Math.min((t - dropDelay) / JUMP_DURATION, 1)
        meshRef.current.position.y = REST_Y + JUMP_PEAK * 4 * progress * (1 - progress)
        const rotEased = 1 - Math.pow(1 - progress, 2)
        meshRef.current.rotation.y = Math.PI + Math.PI * 0.5 * (1 - rotEased)
        if (progress >= 1) {
          landed.current = true
          landTime.current = Date.now()
        }
        return
      }
    }

    // Horizontal movement — smooth lerp normally, instant snap in power-saving
    if (powerSaving) {
      visualX.current = targetX.current
      visualZ.current = targetZ.current
    } else {
      if (moveT.current < 1) {
        moveT.current = Math.min(moveT.current + delta / moveDuration.current, 1)
        // cubic ease-in-out
        const t = moveT.current
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        visualX.current = moveStartX.current + (targetX.current - moveStartX.current) * ease
        visualZ.current = moveStartZ.current + (targetZ.current - moveStartZ.current) * ease
      } else {
        visualX.current = targetX.current
        visualZ.current = targetZ.current
      }
      moveArc.current *= Math.exp(-5.5 * delta)
    }
    meshRef.current.position.x = visualX.current
    meshRef.current.position.z = visualZ.current

    // Menu fade — lerp opacity based on phase
    const targetOpacity = (menuPhase === 'hiding' || menuPhase === 'hidden') ? 0 : 1
    menuOpacity.current += (targetOpacity - menuOpacity.current) * Math.min(delta * 7, 1)
    const op = menuOpacity.current
    meshRef.current.visible = op > 0.01
    meshRef.current.castShadow = op > 0.5
    if (materialRef.current) materialRef.current.opacity = op

    if (menuPhase === 'hiding' || menuPhase === 'hidden') return

    // Selected glow — pulse emissive and halo
    if (materialRef.current) {
      const targetIntensity = isSelected && !powerSaving
        ? 0.55 + Math.sin(clock.elapsedTime * 3.2) * 0.25
        : 0.15
      materialRef.current.emissiveIntensity += (targetIntensity - materialRef.current.emissiveIntensity) * Math.min(delta * 6, 1)
    }
    if (haloRef.current) {
      const targetOpacity = isSelected && !powerSaving ? 0.13 + Math.sin(clock.elapsedTime * 3.2) * 0.05 : 0
      haloRef.current.opacity += (targetOpacity - haloRef.current.opacity) * Math.min(delta * 6, 1)
    }

    // idle / appearing — normal gameplay position + travel arc
    meshRef.current.rotation.y = Math.PI
    const settle = (Date.now() - landTime.current) / 1000
    const knock = settle < 0.14 ? Math.sin((settle / 0.14) * Math.PI) * -0.055 : 0
    const targetY = (isSelected ? 0.55 : REST_Y) + moveArc.current + knock
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * Math.min(delta * 8, 1)

    // Fire pending celebration once the piece has settled at its destination
    const dx = Math.abs(visualX.current - targetX.current)
    const dz = Math.abs(visualZ.current - targetZ.current)
    if (pendingCelebrate.current && dx < 0.08 && dz < 0.08 && Date.now() >= celebrateReadyTime.current) {
      pendingCelebrate.current = false
      celebrateT.current = 0
      celebrating.current = true
    }

    // Capture celebration — small jump and spin overlaid on top of idle position
    if (celebrating.current) {
      celebrateT.current += delta
      const t = celebrateT.current / CELEBRATE_DURATION
      if (t >= 1) {
        celebrating.current = false
        celebrateT.current = 0
      } else {
        meshRef.current.position.y += Math.sin(t * Math.PI) * 0.13
        meshRef.current.rotation.y = Math.PI + t * Math.PI * 2
      }
    }
  })

  const glowColor = isKing ? '#ffaa00' : isDefender ? '#d4b870' : '#aaccff'

  return (
    <mesh
      ref={meshRef}
      position={[0, REST_Y, 0]}
      castShadow={!powerSaving}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <latheGeometry args={[points, 32]} />
      <meshPhysicalMaterial
        ref={materialRef}
        transparent
        map={texture}
        bumpMap={roughnessMap}
        bumpScale={0.6}
        roughness={0.9}
        metalness={0.0}
        clearcoat={0.0}
        emissiveMap={texture}
        emissive={isKing ? '#c8880a' : isDefender ? '#9a7a40' : '#ffffff'}
        emissiveIntensity={0.15}
      />
      {/* Outer glow halo — opacity driven by useFrame */}
      <mesh scale={1.18}>
        <latheGeometry args={[points, 20]} />
        <meshStandardMaterial
          ref={haloRef}
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={1}
          transparent
          opacity={0}
          depthWrite={false}
          side={2}
        />
      </mesh>
    </mesh>
  )
}
