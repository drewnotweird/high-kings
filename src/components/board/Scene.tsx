import { useRef, Suspense, useState, useEffect, useContext, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, useProgress } from '@react-three/drei'
import { PointLight, DirectionalLight, SpotLight, AmbientLight, Group, Vector3, Mesh, MeshStandardMaterial } from 'three'
import { Board } from './Board'
import { Piece, type MenuPhase } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { getBoardConfig } from '../../game/hnefatafl'
import { themes } from '../../lib/themes'
import { IntroStartContext } from '../../contexts/intro'

const DUST_DURATION = 1.5
// Delay between move completing in the store and dust cloud appearing — gives the
// mover time to visually arrive at the captured piece's position before it explodes.
const CAPTURE_DELAY_MS = 450

type ParticleKind = 'debris' | 'flame' | 'smoke'
interface Particle {
  kind: ParticleKind
  vx: number; vy: number; vz: number
  // spin axis and speed
  spinX: number; spinZ: number; spinSpeed: number
  size: number
  // non-uniform scale for shard effect (x, y, z multipliers)
  sx: number; sy: number; sz: number
  cx: number; cy: number; cz: number
  color: string
  maxOpacity: number
  fadeEnd: number
}

function DustCloud({ x, z, onDone }: { x: number; z: number; onDone: () => void }) {
  const meshRefs = useRef<(Mesh | null)[]>([])
  const elapsed = useRef(0)
  const called = useRef(false)

  const particles = useMemo<Particle[]>(() => {
    const debris: Particle[] = Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const speed = 2.4 + Math.random() * 3.4
      const s = 0.06 + Math.random() * 0.07
      return {
        kind: 'debris',
        vx: Math.cos(angle) * speed,
        vy: 0.6 + Math.random() * 2.2,
        vz: Math.sin(angle) * speed,
        spinX: (Math.random() - 0.5) * 2,
        spinZ: (Math.random() - 0.5) * 2,
        spinSpeed: 4 + Math.random() * 8,
        size: s,
        sx: 0.5 + Math.random() * 1.2,
        sy: 1.0 + Math.random() * 2.0,
        sz: 0.4 + Math.random() * 0.8,
        cx: x + (Math.random() - 0.5) * 0.2,
        cy: 0.5 + Math.random() * 0.3,
        cz: z + (Math.random() - 0.5) * 0.2,
        color: Math.random() > 0.5 ? '#d4a855' : '#b88830',
        maxOpacity: 1.0,
        fadeEnd: 0.55,
      }
    })
    const flames: Particle[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'flame' as const,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 2.0 + Math.random() * 4.0,
      vz: (Math.random() - 0.5) * 1.6,
      spinX: (Math.random() - 0.5),
      spinZ: (Math.random() - 0.5),
      spinSpeed: 3 + Math.random() * 5,
      size: 0.055 + Math.random() * 0.055,
      sx: 0.4 + Math.random() * 0.6,
      sy: 1.5 + Math.random() * 2.0,
      sz: 0.4 + Math.random() * 0.6,
      cx: x + (Math.random() - 0.5) * 0.35,
      cy: 0.3 + Math.random() * 0.3,
      cz: z + (Math.random() - 0.5) * 0.35,
      color: i % 3 === 0 ? '#ff2200' : i % 3 === 1 ? '#ff6600' : '#ffaa00',
      maxOpacity: 0.95,
      fadeEnd: 0.38,
    }))
    const smoke: Particle[] = Array.from({ length: 8 }, () => ({
      kind: 'smoke' as const,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.4 + Math.random() * 0.7,
      vz: (Math.random() - 0.5) * 0.5,
      spinX: 0, spinZ: 0, spinSpeed: 0,
      size: 0.18 + Math.random() * 0.22,
      sx: 1, sy: 1, sz: 1,
      cx: x + (Math.random() - 0.5) * 0.6,
      cy: 0.5 + Math.random() * 0.4,
      cz: z + (Math.random() - 0.5) * 0.6,
      color: '#2a2a2a',
      maxOpacity: 0.13,
      fadeEnd: 1.0,
    }))
    return [...debris, ...flames, ...smoke]
  }, [])

  const pos = useRef(particles.map(p => ({ x: p.cx, y: p.cy, z: p.cz })))

  useFrame((_, delta) => {
    if (called.current) return
    elapsed.current += delta
    const t = elapsed.current / DUST_DURATION

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const p = particles[i]
      const gravity = p.kind === 'smoke' ? 0.5 : p.kind === 'flame' ? 1.2 : 5
      pos.current[i].x += p.vx * delta
      pos.current[i].y += p.vy * delta - gravity * elapsed.current * delta
      pos.current[i].z += p.vz * delta
      const yFloor = p.kind === 'smoke' ? 0.3 : 0.04
      mesh.position.set(pos.current[i].x, Math.max(pos.current[i].y, yFloor), pos.current[i].z)

      // Spin shards
      if (p.spinSpeed > 0) {
        mesh.rotation.x += p.spinX * p.spinSpeed * delta
        mesh.rotation.z += p.spinZ * p.spinSpeed * delta
      }

      // Smoke expands as it rises
      if (p.kind === 'smoke') {
        const scale = 1 + t * 2.5
        mesh.scale.setScalar(scale)
      }

      const opacity = p.maxOpacity * Math.max(0, 1 - t / p.fadeEnd)
      ;(mesh.material as MeshStandardMaterial).opacity = opacity
    })

    if (elapsed.current >= DUST_DURATION && !called.current) {
      called.current = true
      onDone()
    }
  })

  return (
    <>
      {particles.map((p, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el }}
          position={[p.cx, p.cy, p.cz]}
          scale={[p.sx * p.size, p.sy * p.size, p.sz * p.size]}
          rotation={[Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2]}
        >
          {p.kind === 'smoke'
            ? <sphereGeometry args={[1, 5, 4]} />
            : p.kind === 'flame'
              ? <tetrahedronGeometry args={[1, 0]} />
              : <octahedronGeometry args={[1, 0]} />
          }
          <meshStandardMaterial
            color={p.color}
            roughness={0.7}
            transparent
            opacity={p.maxOpacity}
            depthWrite={false}
            emissive={p.kind === 'flame' ? p.color : '#000000'}
            emissiveIntensity={p.kind === 'flame' ? 0.9 : 0}
          />
        </mesh>
      ))}
    </>
  )
}

const BOARD_ARRIVE = 1.2
const PIECE_STAGGER = 0.035
const BOARD_DURATION = 1.1
const PIECE_ANIM_DURATION = 0.36
export function getIntroDurationMs(numPieces: number): number {
  return Math.ceil((BOARD_ARRIVE + (numPieces - 1) * PIECE_STAGGER + PIECE_ANIM_DURATION) * 1000) + 300
}
const BOARD_START_Y = -20

function FadingLights({ menuOpen, powerSaving }: { menuOpen: boolean; powerSaving: boolean }) {
  const introStartMs = useContext(IntroStartContext)
  const { pieces, rules } = useGameStore()
  const ambientRef = useRef<AmbientLight>(null)
  const moonRef = useRef<DirectionalLight>(null)
  const spotRef = useRef<SpotLight>(null)
  const frontRef = useRef<DirectionalLight>(null)
  const bounceRef = useRef<PointLight>(null)
  const backRef = useRef<PointLight>(null)
  const menuScale = useRef(1)
  const spotLerpX = useRef(0)
  const spotLerpZ = useRef(0)

  useFrame((_, delta) => {
    if (powerSaving) return

    const t = introStartMs ? (Date.now() - introStartMs) / 1000 : -1
    const f = (start: number, dur: number) => 1 - Math.pow(1 - Math.min(Math.max((t - start) / dur, 0), 1), 2)

    const msTarget = menuOpen ? 0 : 1
    menuScale.current += (msTarget - menuScale.current) * Math.min(delta * 6, 1)
    const ms = menuScale.current

    if (ambientRef.current)  ambientRef.current.intensity  = 0.02 * f(0.0, 0.5)
    if (moonRef.current)     moonRef.current.intensity     = 0.25 * f(0.3, 0.5)
    if (spotRef.current)     spotRef.current.intensity     = 20   * f(0.6, 0.5)
    if (frontRef.current)    frontRef.current.intensity    = 0.2  * f(0.9, 0.4)

    const late = f(BOARD_DURATION, 1.2)
    if (bounceRef.current)   bounceRef.current.intensity   = 5 * late * ms
    if (backRef.current)     backRef.current.intensity     = 3 * late

    // Spotlight tracks the king
    if (spotRef.current) {
      const king = pieces.find(p => p.type === 'king')
      if (king) {
        const { boardSize } = getBoardConfig(rules)
        const offset = (boardSize - 1) / 2
        const kx = king.col - offset
        const kz = king.row - offset
        spotLerpX.current += (kx - spotLerpX.current) * Math.min(delta * 4, 1)
        spotLerpZ.current += (kz - spotLerpZ.current) * Math.min(delta * 4, 1)
      }
      spotRef.current.position.x = spotLerpX.current
      spotRef.current.position.z = spotLerpZ.current + 4
      spotRef.current.target.position.x = spotLerpX.current
      spotRef.current.target.position.z = spotLerpZ.current
      spotRef.current.target.updateMatrixWorld()
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} color="#9ab0c8" intensity={0} />
      <directionalLight
        ref={moonRef}
        position={[-3, 20, 5]}
        color="#c8dff8"
        intensity={0}
        castShadow={!powerSaving}
        shadow-mapSize={[1024, 1024]}
        shadow-radius={24}
        shadow-blurSamples={32}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <spotLight
        ref={spotRef}
        position={[0, 20, 4]}
        target-position={[0, 0, 0]}
        color="#e8f0ff"
        intensity={0}
        distance={50}
        angle={0.32}
        penumbra={1.0}
        decay={0.7}
        castShadow={!powerSaving}
        shadow-mapSize={[1024, 1024]}
        shadow-radius={20}
        shadow-blurSamples={32}
      />
      <directionalLight
        ref={frontRef}
        position={[2, 5, 14]}
        color="#ffffff"
        intensity={0}
        castShadow={!powerSaving}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={10}
        shadow-blurSamples={16}
        shadow-camera-near={0.5}
        shadow-camera-far={35}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <pointLight ref={bounceRef} position={[0, -1, 2]} color="#c85010" intensity={0} distance={22} decay={1.8} />
      <pointLight ref={backRef} position={[0, 9, -16]} color="#7090c0" intensity={0} distance={32} decay={1.8} />
    </>
  )
}

function CaptureFlashLight() {
  const { dyingPieces } = useGameStore()
  const lightRef = useRef<PointLight>(null)
  const flashT = useRef(-1)
  const FLASH_DURATION = 0.75

  useEffect(() => {
    if (dyingPieces.length > 0) flashT.current = 0
  }, [dyingPieces])

  useFrame((_, delta) => {
    if (!lightRef.current || flashT.current < 0) return
    flashT.current += delta
    const t = flashT.current / FLASH_DURATION
    if (t >= 1) { lightRef.current.intensity = 0; flashT.current = -1; return }
    lightRef.current.intensity = Math.sin(t * Math.PI) * 22
  })

  return <pointLight ref={lightRef} position={[0, 10, 0]} color="#ff1010" intensity={0} distance={32} decay={1.5} />
}

function FireLight({ menuOpen, powerSaving }: { menuOpen: boolean; powerSaving: boolean }) {
  const introStartMs = useContext(IntroStartContext)
  const ref = useRef<PointLight>(null)
  const menuScale = useRef(1)

  useFrame((_, delta) => {
    if (!ref.current || powerSaving) return
    const t = introStartMs ? (Date.now() - introStartMs) / 1000 : -1
    const fade = Math.min(Math.max((t - BOARD_DURATION) / 1.2, 0), 1)
    const e = 1 - Math.pow(1 - fade, 2)
    const now = Date.now() / 1000
    const flicker = 1 + 0.35 * Math.sin(now * 7.3) + 0.2 * Math.sin(now * 13.1) + 0.1 * Math.sin(now * 3.7)
    const msTarget = menuOpen ? 0 : 1
    menuScale.current += (msTarget - menuScale.current) * Math.min(delta * 6, 1)
    ref.current.intensity = 6 * flicker * e * menuScale.current
  })
  return <pointLight ref={ref} position={[0, -0.5, 3]} color="#ff6010" distance={20} decay={2} intensity={0} />
}

function AnimatedBoard({ children, menuOpen, snapFlipRef }: {
  children: React.ReactNode
  menuOpen: boolean
  snapFlipRef: React.MutableRefObject<boolean>
}) {
  const introStartMs = useContext(IntroStartContext)
  const groupRef = useRef<Group>(null)
  const introDone = useRef(false)
  const flipProgress = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (!introDone.current) {
      const t = introStartMs ? (Date.now() - introStartMs) / 1000 : -1
      if (t < 0) { groupRef.current.position.y = BOARD_START_Y; return }
      const progress = Math.min(t / BOARD_DURATION, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      groupRef.current.position.y = BOARD_START_Y + (-BOARD_START_Y) * eased
      groupRef.current.rotation.x = (1 - eased) * -1.2
      if (progress >= 1) introDone.current = true
      return
    }

    const target = menuOpen ? 1 : 0
    if (snapFlipRef.current && menuOpen) {
      flipProgress.current = 1
      snapFlipRef.current = false
    } else {
      flipProgress.current += (target - flipProgress.current) * Math.min(delta * 4, 1)
    }
    groupRef.current.rotation.x = flipProgress.current * -Math.PI
  })

  return (
    <group ref={groupRef} position={[0, BOARD_START_Y, 0]}>
      {children}
    </group>
  )
}

const DEFAULT_CAM_POS = new Vector3(0, 12, 14)
const DEFAULT_CAM_TARGET = new Vector3(0, 0, 0)

function CameraReset({ menuOpen }: { menuOpen: boolean }) {
  useFrame(({ camera, controls }) => {
    if (!menuOpen) return
    camera.position.lerp(DEFAULT_CAM_POS, 0.06)
    if (controls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = controls as any
      c.target.lerp(DEFAULT_CAM_TARGET, 0.06)
      c.update()
    }
  })
  return null
}

// How long pieces take to fly away / appear
const HIDE_MS = Math.round(PIECE_ANIM_DURATION * 1000) + 50
// How long to wait after board starts returning before restoring lights / showing pieces
const BOARD_RETURN_MS = 1000

function CameraLock({ locked }: { locked: boolean }) {
  const { size } = useThree()
  const { rules } = useGameStore()
  const boardSize = getBoardConfig(rules).boardSize
  // Compute height so the board fits horizontally and vertically with margin
  const topDownCam = useMemo(() => {
    const aspect = size.width / size.height
    const fovHalfRad = (45 * Math.PI) / 180 / 2
    const tan = Math.tan(fovHalfRad)
    // Horizontal fit: half-board + margin
    const hHoriz = (boardSize / 2 + 1.1) / (tan * aspect)
    // Vertical fit: board must occupy ≤ (100vh - 280px) of screen height
    const usableH = Math.max(size.height - 280, 100)
    const hVert = (boardSize * size.height) / (2 * tan * usableH)
    const h = Math.max(22, hHoriz, hVert)
    return new Vector3(0, h, 0.01)
  }, [size.width, size.height, boardSize])

  const prevLocked = useRef(false)

  useFrame(({ camera, controls }, delta) => {
    if (!locked) { prevLocked.current = false; return }
    const firstFrame = !prevLocked.current
    prevLocked.current = true
    const speed = firstFrame ? 1 : Math.min(delta * 5, 1)
    camera.position.lerp(topDownCam, speed)
    if (controls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = controls as any
      c.target.lerp(DEFAULT_CAM_TARGET, speed)
      c.update()
    }
  })
  return null
}

interface SceneInnerProps {
  menuOpen: boolean
  dropStartMs: number | null
  dropKey: number
}

function SceneInner({ menuOpen, dropStartMs, dropKey }: SceneInnerProps) {
  const { pieces, dyingPieces, clearDyingPieces, selectedId, theme: themeName, selectPiece, cameraLocked, powerSaving, rules } = useGameStore()
  const theme = themes[themeName]
  const [menuPhase, setMenuPhase] = useState<MenuPhase>('idle')

  // Capture dust clouds — fire when dyingPieces are set, delay until mover arrives
  const [dustClouds, setDustClouds] = useState<{ key: number; x: number; z: number }[]>([])

  useEffect(() => {
    if (powerSaving || dyingPieces.length === 0) return
    const { boardSize } = getBoardConfig(rules)
    const boardOffset = (boardSize - 1) / 2
    const clouds = dyingPieces.map(p => ({
      key: Date.now() + Math.random() * 1000,
      x: p.col - boardOffset,
      z: p.row - boardOffset,
    }))
    const timer = setTimeout(() => {
      clearDyingPieces()
      setDustClouds(prev => [...prev, ...clouds])
    }, CAPTURE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [dyingPieces])
  // boardFlipOpen is delayed: pieces hide first, THEN board flips
  const [boardFlipOpen, setBoardFlipOpen] = useState(false)
  // lights cut immediately on open, restored only after board has returned
  const [lightsOn, setLightsOn] = useState(true)
  const everOpened = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const snapFlipRef = useRef(false)
  // Tracks previous powerSaving value so menuOpen effect can detect power-saving recovery
  const prevPowerSaving = useRef(false)

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  useEffect(() => {
    clearTimers()
    if (menuOpen) {
      everOpened.current = true
      setLightsOn(false)
      if (prevPowerSaving.current) {
        // Recovering from power-saving: menu was already open, snap board to flipped position
        setMenuPhase('hidden')
        setBoardFlipOpen(true)
        snapFlipRef.current = true
      } else {
        setMenuPhase('hiding')
        // Step 2: after pieces are gone, start board flip
        timers.current.push(setTimeout(() => {
          setMenuPhase('hidden')
          setBoardFlipOpen(true)
        }, HIDE_MS))
      }
    } else if (everOpened.current) {
      // Board starts returning immediately
      setBoardFlipOpen(false)
      // After board has returned: restore lights and show pieces
      timers.current.push(setTimeout(() => {
        setLightsOn(true)
        setMenuPhase('appearing')
      }, BOARD_RETURN_MS))
      timers.current.push(setTimeout(() => {
        setMenuPhase('idle')
      }, BOARD_RETURN_MS + HIDE_MS))
    }
    return clearTimers
  }, [menuOpen])

  // Keep prevPowerSaving in sync — must be declared after useEffect([menuOpen]) so the
  // menuOpen effect reads the OLD value when both deps change in the same render
  useEffect(() => {
    prevPowerSaving.current = powerSaving
  }, [powerSaving])

  // New game: clear timers, reset state — pieces remount and do sequential intro drop
  useEffect(() => {
    if (dropKey > 0) {
      clearTimers()
      setBoardFlipOpen(false)
      setMenuPhase('idle')
      setLightsOn(false)
      everOpened.current = false
      // Restore lights after board has returned
      timers.current.push(setTimeout(() => setLightsOn(true), BOARD_RETURN_MS))
    }
  }, [dropKey])

  const ordered = [
    ...pieces.filter(p => p.type === 'king'),
    ...pieces.filter(p => p.type === 'defender'),
    ...pieces.filter(p => p.type === 'attacker'),
  ]
  const delayMap = new Map(ordered.map((p, i) => [p.id, BOARD_ARRIVE + i * PIECE_STAGGER]))

  return (
    <>
      <fog attach="fog" args={["#0a0800", 28, 55]} />
      <Environment preset="night" environmentIntensity={0.0} />
      <FadingLights menuOpen={!lightsOn} powerSaving={powerSaving} />
      <FireLight menuOpen={!lightsOn} powerSaving={powerSaving} />
      {!powerSaving && <CaptureFlashLight />}
      <AnimatedBoard menuOpen={boardFlipOpen} snapFlipRef={snapFlipRef}>
        <Board theme={theme} />
      </AnimatedBoard>
      {pieces.map((piece) => (
        <Piece
          key={`${piece.id}-${dropKey}`}
          piece={piece}
          theme={theme}
          isSelected={selectedId === piece.id}
          dropDelay={delayMap.get(piece.id) ?? BOARD_ARRIVE}
          dropStartMs={dropStartMs}
          menuPhase={menuPhase}
          onClick={() => selectPiece(selectedId === piece.id ? null : piece.id)}
        />
      ))}
      {dustClouds.map(dc => (
        <DustCloud
          key={dc.key}
          x={dc.x}
          z={dc.z}
          onDone={() => setDustClouds(prev => prev.filter(d => d.key !== dc.key))}
        />
      ))}
      <CameraReset menuOpen={menuOpen} />
      <CameraLock locked={cameraLocked && !menuOpen} />
      <OrbitControls
        makeDefault
        enabled={!menuOpen && !cameraLocked}
        enablePan={false}
        minDistance={6}
        maxDistance={32}
        minPolarAngle={(!menuOpen && cameraLocked) ? Math.PI * 0.01 : 0.3}
        maxPolarAngle={(!menuOpen && cameraLocked) ? Math.PI * 0.01 : Math.PI / 2.2}
        target={[0, 0, 0]}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  )
}

type LoaderPhase = 'loading' | 'holding' | 'fading' | 'done'

function LoadingOverlay({ onDone }: { onDone: () => void }) {
  const { active } = useProgress()
  const [phase, setPhase] = useState<LoaderPhase>('loading')
  const minHoldMet = useRef(false)
  const loadingDone = useRef(false)
  const wasActive = useRef(false)

  const tryStartFade = () => {
    if (minHoldMet.current && loadingDone.current) {
      setPhase('fading')
      setTimeout(() => {
        setPhase('done')
        onDone()
      }, 600)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      minHoldMet.current = true
      // If active never went true, assets were cached — treat as loaded
      if (!loadingDone.current) {
        loadingDone.current = true
        setPhase('holding')
      }
      tryStartFade()
    }, 1000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (active) {
      wasActive.current = true
    } else if (wasActive.current && phase === 'loading') {
      // active went true then false — real load cycle completed
      loadingDone.current = true
      setPhase('holding')
      tryStartFade()
    }
  }, [active])

  if (phase === 'done') return null

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 65%, #2a1200 0%, #0a0800 55%, #000 100%)',
      zIndex: 10,
      pointerEvents: 'none',
      opacity: phase === 'fading' ? 0 : 1,
      transition: phase === 'fading' ? 'opacity 1s ease-out' : 'none',
    }}>
      <img
        src={`${import.meta.env.BASE_URL}loader.gif`}
        alt="Loading…"
        style={{ width: 64, height: 64, objectFit: 'contain' }}
      />
    </div>
  )
}

export function Scene({ onIntroStart, menuOpen, onNewGame }: {
  onIntroStart?: () => void
  menuOpen?: boolean
  onNewGame?: () => void
}) {
  const [introStartMs, setIntroStartMs] = useState<number | null>(null)
  const [dropStartMs, setDropStartMs] = useState<number | null>(null)
  const [dropKey, setDropKey] = useState(0)
  const { gameKey } = useGameStore()
  const prevGameKey = useRef(0)

  useEffect(() => {
    if (gameKey > prevGameKey.current) {
      prevGameKey.current = gameKey
      setDropStartMs(Date.now())
      setDropKey(k => k + 1)
      onNewGame?.()
    }
  }, [gameKey])

  return (
    <IntroStartContext.Provider value={introStartMs}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Canvas
          shadows={{ type: 2 }}
          camera={{ position: [0, 12, 14], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <SceneInner menuOpen={!!menuOpen} dropStartMs={dropStartMs} dropKey={dropKey} />
          </Suspense>
        </Canvas>
        <LoadingOverlay onDone={() => {
          const now = Date.now()
          setIntroStartMs(now)
          setDropStartMs(now)
          onIntroStart?.()
        }} />
      </div>
    </IntroStartContext.Provider>
  )
}
