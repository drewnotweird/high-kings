import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  InstancedMesh, Mesh, Vector2, LatheGeometry, Matrix4, Quaternion, Vector3,
  MeshPhysicalMaterial, MeshStandardMaterial, Color,
} from 'three'
import { getBoardConfig } from '../../game/hnefatafl'
import type { Piece as PieceData } from '../../game/hnefatafl'
import { useGameStore } from '../../store/gameStore'
import type { MenuPhase } from './Piece'

const W = 1.35
const REST_Y = 0.15
const HOVER_LIFT = 0.28
const JUMP_PEAK = 1.4
const JUMP_DURATION = 0.36
const CELEBRATE_DURATION = 0.7
const MAX_ATTACKERS = 72
const MAX_DEFENDERS = 24
const BOARD_ARRIVE = 1.2

const NORMAL_POINTS = [
  new Vector2(0,       0   ),
  new Vector2(0.26*W,  0   ),
  new Vector2(0.28*W,  0.05),
  new Vector2(0.23*W,  0.16),
  new Vector2(0.20*W,  0.55),
  new Vector2(0.18*W,  0.72),
  new Vector2(0.14*W,  0.83),
  new Vector2(0.07*W,  0.90),
  new Vector2(0,       0.92),
]

interface PieceAnim {
  targetX: number; targetZ: number
  visualX: number; visualZ: number
  posY: number; rotY: number
  moveStartX: number; moveStartZ: number
  moveT: number; moveDuration: number; moveArc: number
  landed: boolean; landTime: number
  dropDelay: number
  celebrateT: number; celebrating: boolean
  pendingCelebrate: boolean; celebrateReadyTime: number
  shakeT: number; shakePhase: number
  hovered: boolean; isHoverable: boolean
  instanceIdx: number
  type: 'attacker' | 'defender'
}

interface PiecesLayerProps {
  nonKingPieces: PieceData[]
  dropStartMs: number | null
  delayMap: Map<string, number>
  menuPhase: MenuPhase
}

export function PiecesLayer({ nonKingPieces, dropStartMs, delayMap, menuPhase }: PiecesLayerProps) {
  const {
    rules, boardSize: storedBoardSize, powerSaving, captorIds, undoTrigger,
    currentTurn, playerMode, winner, selectedId, selectPiece, roleSelectOpen,
  } = useGameStore()

  const boardOffset = (getBoardConfig(rules, storedBoardSize).boardSize - 1) / 2

  const attackerRef    = useRef<InstancedMesh>(null)
  const defenderRef    = useRef<InstancedMesh>(null)
  const attackerMatRef = useRef<MeshPhysicalMaterial>(null)
  const defenderMatRef = useRef<MeshPhysicalMaterial>(null)
  const haloMeshRef    = useRef<Mesh>(null)
  const haloMatRef     = useRef<MeshStandardMaterial>(null)

  // Textures
  const attackerTex   = useTexture(`${import.meta.env.BASE_URL}textures/piece-dark.png`)
  const attackerRough = useTexture(`${import.meta.env.BASE_URL}textures/piece-dark-roughness.png`)
  const defenderTex   = useTexture(`${import.meta.env.BASE_URL}textures/piece-light.png`)
  const defenderRough = useTexture(`${import.meta.env.BASE_URL}textures/piece-light-roughness.png`)

  // Shared geometry — same profile for all normal pieces
  const geometry = useMemo(() => new LatheGeometry(NORMAL_POINTS, 32), [])

  // Animation state
  const animMap       = useRef<Map<string, PieceAnim>>(new Map())
  const attackerSlots = useRef<(string | null)[]>(Array(MAX_ATTACKERS).fill(null))
  const defenderSlots = useRef<(string | null)[]>(Array(MAX_DEFENDERS).fill(null))

  // Scratch objects — reused every frame to avoid GC pressure
  const _m4   = useRef(new Matrix4())
  const _pos  = useRef(new Vector3())
  const _quat = useRef(new Quaternion())
  const _scl  = useRef(new Vector3(1, 1, 1))
  const _yAxis = useRef(new Vector3(0, 1, 0))
  const _zero = useRef(new Matrix4().makeScale(0, 0, 0))

  // Sync animMap when pieces array changes
  useEffect(() => {
    const currentIds = new Set(nonKingPieces.map(p => p.id))

    // Remove stale
    for (const [id, anim] of animMap.current.entries()) {
      if (!currentIds.has(id)) {
        if (anim.type === 'attacker') attackerSlots.current[anim.instanceIdx] = null
        else defenderSlots.current[anim.instanceIdx] = null
        animMap.current.delete(id)
      }
    }

    // Add / update
    for (const piece of nonKingPieces) {
      const x = piece.col - boardOffset
      const z = piece.row - boardOffset

      if (animMap.current.has(piece.id)) {
        const anim = animMap.current.get(piece.id)!
        const dx = x - anim.visualX
        const dz = z - anim.visualZ
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (!powerSaving && dist > 0.05 && anim.landed) {
          anim.moveStartX  = anim.visualX
          anim.moveStartZ  = anim.visualZ
          anim.moveDuration = Math.max(0.5, dist * 0.28)
          anim.moveT       = 0
          anim.moveArc     = Math.min(dist * 0.22, 0.55)
        }
        anim.targetX = x
        anim.targetZ = z
      } else {
        const isAttacker = piece.type === 'attacker'
        const slots = isAttacker ? attackerSlots.current : defenderSlots.current
        const max   = isAttacker ? MAX_ATTACKERS : MAX_DEFENDERS
        let idx = -1
        for (let i = 0; i < max; i++) { if (slots[i] === null) { idx = i; break } }
        if (idx === -1) continue
        slots[idx] = piece.id

        animMap.current.set(piece.id, {
          targetX: x, targetZ: z,
          visualX: x, visualZ: z,
          posY: REST_Y, rotY: Math.PI,
          moveStartX: x, moveStartZ: z,
          moveT: 1, moveDuration: 0.5, moveArc: 0,
          landed: false, landTime: 0,
          dropDelay: delayMap.get(piece.id) ?? BOARD_ARRIVE,
          celebrateT: 0, celebrating: false,
          pendingCelebrate: false, celebrateReadyTime: 0,
          shakeT: -1, shakePhase: Math.random() * Math.PI * 2,
          hovered: false, isHoverable: false,
          instanceIdx: idx,
          type: piece.type as 'attacker' | 'defender',
        })
      }
    }
  }, [nonKingPieces, boardOffset, powerSaving, delayMap])

  // Undo shake — all pieces
  useEffect(() => {
    if (undoTrigger > 0 && !powerSaving) {
      for (const anim of animMap.current.values()) anim.shakeT = 0
    }
  }, [undoTrigger])

  // Captor celebration
  useEffect(() => {
    if (!captorIds.length || powerSaving) return
    for (const id of captorIds) {
      const anim = animMap.current.get(id)
      if (anim) { anim.pendingCelebrate = true; anim.celebrateReadyTime = Date.now() + 450 }
    }
  }, [captorIds])

  useFrame(({ clock }, delta) => {
    if (!attackerRef.current || !defenderRef.current) return
    const now = Date.now()
    const elapsed = clock.elapsedTime

    // Hide pieces instantly when menu opens or role select is showing
    const hiding = menuPhase === 'hiding' || menuPhase === 'hidden' || roleSelectOpen
    attackerRef.current.visible = !hiding
    defenderRef.current.visible = !hiding
    attackerRef.current.castShadow = !hiding
    defenderRef.current.castShadow = !hiding

    // Halo overlay — follows selected non-king piece
    const selectedAnim = selectedId ? animMap.current.get(selectedId) : null
    if (haloMeshRef.current && haloMatRef.current) {
      const visible = !!selectedAnim && !powerSaving && !hiding
      haloMeshRef.current.visible = visible
      if (visible && selectedAnim) {
        haloMeshRef.current.position.set(selectedAnim.visualX, selectedAnim.posY, selectedAnim.visualZ)
        haloMeshRef.current.rotation.y = selectedAnim.rotY
        const glowColor = selectedAnim.type === 'defender' ? '#d4b870' : '#aaccff'
        haloMatRef.current.color = new Color(glowColor)
        haloMatRef.current.emissive = new Color(glowColor)
        const targetOpacity = 0.13 + Math.sin(elapsed * 3.2) * 0.05
        haloMatRef.current.opacity += (targetOpacity - haloMatRef.current.opacity) * Math.min(delta * 6, 1)
      } else if (haloMatRef.current.opacity > 0.001) {
        haloMatRef.current.opacity += (0 - haloMatRef.current.opacity) * Math.min(delta * 6, 1)
      }
    }

    // Zero unused slots once up front (avoids identity-matrix ghosts at origin)
    for (let i = 0; i < MAX_ATTACKERS; i++) {
      if (attackerSlots.current[i] === null)
        attackerRef.current.setMatrixAt(i, _zero.current)
    }
    for (let i = 0; i < MAX_DEFENDERS; i++) {
      if (defenderSlots.current[i] === null)
        defenderRef.current.setMatrixAt(i, _zero.current)
    }

    for (const [id, anim] of animMap.current.entries()) {
      const isAttacker = anim.type === 'attacker'
      const mesh = isAttacker ? attackerRef.current : defenderRef.current
      const isSelected = id === selectedId

      // Hoverable
      const pieceIsDefender = anim.type === 'defender'
      anim.isHoverable = !powerSaving && !winner && (
        playerMode === '2player'
          ? (currentTurn === 'defender') === pieceIsDefender
          : playerMode === 'defender'
            ? pieceIsDefender && currentTurn === 'defender'
            : !pieceIsDefender && currentTurn === 'attacker'
      )
      if (!anim.isHoverable) anim.hovered = false

      // Intro drop
      const dropT = dropStartMs ? (now - dropStartMs) / 1000 : -1
      if (!anim.landed) {
        if (powerSaving) {
          anim.landed = true; anim.landTime = now
          anim.posY = REST_Y; anim.rotY = Math.PI
        } else {
          if (dropT < 0 || dropT < anim.dropDelay) {
            mesh.setMatrixAt(anim.instanceIdx, _zero.current)
            continue
          }
          const progress = Math.min((dropT - anim.dropDelay) / JUMP_DURATION, 1)
          anim.posY = REST_Y + JUMP_PEAK * 4 * progress * (1 - progress)
          const rotEased = 1 - Math.pow(1 - progress, 2)
          anim.rotY = Math.PI + Math.PI * 0.5 * (1 - rotEased)
          if (progress >= 1) { anim.landed = true; anim.landTime = now }
        }
      }

      // Horizontal movement
      if (powerSaving) {
        anim.visualX = anim.targetX
        anim.visualZ = anim.targetZ
      } else {
        if (anim.moveT < 1) {
          anim.moveT = Math.min(anim.moveT + delta / anim.moveDuration, 1)
          const mt = anim.moveT
          const ease = mt < 0.5 ? 4*mt*mt*mt : 1 - Math.pow(-2*mt + 2, 3) / 2
          anim.visualX = anim.moveStartX + (anim.targetX - anim.moveStartX) * ease
          anim.visualZ = anim.moveStartZ + (anim.targetZ - anim.moveStartZ) * ease
        } else {
          anim.visualX = anim.targetX
          anim.visualZ = anim.targetZ
        }
        anim.moveArc *= Math.exp(-5.5 * delta)
      }

      // Y position
      anim.rotY = Math.PI
      const settle = (now - anim.landTime) / 1000
      const knock  = settle < 0.14 ? Math.sin((settle / 0.14) * Math.PI) * -0.055 : 0
      const liftY  = anim.hovered && !isSelected ? HOVER_LIFT : 0
      const targetY = (isSelected ? 0.55 : REST_Y + liftY) + anim.moveArc + knock
      anim.posY += (targetY - anim.posY) * Math.min(delta * 8, 1)

      // Pending celebration
      const dx = Math.abs(anim.visualX - anim.targetX)
      const dz = Math.abs(anim.visualZ - anim.targetZ)
      if (anim.pendingCelebrate && dx < 0.08 && dz < 0.08 && now >= anim.celebrateReadyTime) {
        anim.pendingCelebrate = false; anim.celebrateT = 0; anim.celebrating = true
      }

      // Celebration jump + spin
      let celebY = 0, celebRotY = 0
      if (anim.celebrating) {
        anim.celebrateT += delta
        const ct = anim.celebrateT / CELEBRATE_DURATION
        if (ct >= 1) { anim.celebrating = false; anim.celebrateT = 0 }
        else { celebY = Math.sin(ct * Math.PI) * 0.13; celebRotY = ct * Math.PI * 2 }
      }

      // Undo shake
      let shakeX = 0, shakeZ = 0
      if (anim.shakeT >= 0) {
        anim.shakeT += delta
        if (anim.shakeT >= 0.65) {
          anim.shakeT = -1
        } else {
          const decay = 1 - anim.shakeT / 0.65
          const amp   = 0.14 * decay * decay
          shakeX = Math.sin(anim.shakeT * 38 + anim.shakePhase) * amp
          shakeZ = Math.cos(anim.shakeT * 29 + anim.shakePhase) * amp * 0.6
        }
      }

      // Build and write matrix
      _pos.current.set(anim.visualX + shakeX, anim.posY + celebY, anim.visualZ + shakeZ)
      _quat.current.setFromAxisAngle(_yAxis.current, anim.rotY + celebRotY)
      _scl.current.setScalar(1)
      _m4.current.compose(_pos.current, _quat.current, _scl.current)
      mesh.setMatrixAt(anim.instanceIdx, _m4.current)
    }

    attackerRef.current.instanceMatrix.needsUpdate = true
    defenderRef.current.instanceMatrix.needsUpdate = true
  })

  // Pointer helpers — read instanceId from R3F ThreeEvent
  const handleClick = (slots: (string | null)[]) => (e: any) => {
    e.stopPropagation()
    const instanceId = e.instanceId ?? e.intersection?.instanceId ?? e.intersections?.[0]?.instanceId
    if (instanceId == null) return
    const id = slots[instanceId as number]
    if (id) selectPiece(id)
  }
  const handleEnter = (slots: (string | null)[]) => (e: any) => {
    const id = slots[e.instanceId as number]
    if (id) { const a = animMap.current.get(id); if (a?.isHoverable) a.hovered = true }
  }
  const handleLeave = (slots: (string | null)[]) => (e: any) => {
    const id = slots[e.instanceId as number]
    if (id) { const a = animMap.current.get(id); if (a) a.hovered = false }
  }

  return (
    <>
      <instancedMesh
        ref={attackerRef}
        args={[geometry, undefined, MAX_ATTACKERS]}
        castShadow
        visible={!roleSelectOpen}
        onClick={handleClick(attackerSlots.current)}
        onPointerEnter={handleEnter(attackerSlots.current)}
        onPointerLeave={handleLeave(attackerSlots.current)}
      >
        <meshPhysicalMaterial
          ref={attackerMatRef}
          map={attackerTex}
          bumpMap={attackerRough}
          bumpScale={0.6}
          roughness={0.9}
          metalness={0}
          clearcoat={0}
          emissiveMap={attackerTex}
          emissive="#ffffff"
          emissiveIntensity={0.15}
        />
      </instancedMesh>
      <instancedMesh
        ref={defenderRef}
        args={[geometry, undefined, MAX_DEFENDERS]}
        castShadow
        visible={!roleSelectOpen}
        onClick={handleClick(defenderSlots.current)}
        onPointerEnter={handleEnter(defenderSlots.current)}
        onPointerLeave={handleLeave(defenderSlots.current)}
      >
        <meshPhysicalMaterial
          ref={defenderMatRef}
          map={defenderTex}
          bumpMap={defenderRough}
          bumpScale={0.6}
          roughness={0.9}
          metalness={0}
          clearcoat={0}
          emissiveMap={defenderTex}
          emissive="#9a7a40"
          emissiveIntensity={0.15}
        />
      </instancedMesh>
      {/* Halo ring — follows the selected non-king piece */}
      <mesh ref={haloMeshRef} scale={1.18} visible={false}>
        <latheGeometry args={[NORMAL_POINTS, 20]} />
        <meshStandardMaterial
          ref={haloMatRef}
          color="#d4b870"
          emissive="#d4b870"
          emissiveIntensity={1}
          transparent
          opacity={0}
          depthWrite={false}
          side={2}
        />
      </mesh>
    </>
  )
}
