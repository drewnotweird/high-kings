import { useRef, Suspense, useState, useEffect, useContext } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, useProgress } from '@react-three/drei'
import { PointLight, DirectionalLight, SpotLight, AmbientLight, Group, Vector3 } from 'three'
import { Board } from './Board'
import { Piece, type MenuPhase } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { themes } from '../../lib/themes'
import { IntroStartContext } from '../../contexts/intro'

const BOARD_ARRIVE = 1.2
const PIECE_STAGGER = 0.07
const BOARD_DURATION = 1.1
const PIECE_ANIM_DURATION = 0.36
const BOARD_START_Y = -20

function FadingLights({ menuOpen }: { menuOpen: boolean }) {
  const introStartMs = useContext(IntroStartContext)
  const ambientRef = useRef<AmbientLight>(null)
  const moonRef = useRef<DirectionalLight>(null)
  const spotRef = useRef<SpotLight>(null)
  const frontRef = useRef<DirectionalLight>(null)
  const bounceRef = useRef<PointLight>(null)
  const backRef = useRef<PointLight>(null)
  const menuScale = useRef(1)

  useFrame((_, delta) => {
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
  })

  return (
    <>
      <ambientLight ref={ambientRef} color="#9ab0c8" intensity={0} />
      <directionalLight
        ref={moonRef}
        position={[-3, 20, 5]}
        color="#c8dff8"
        intensity={0}
        castShadow
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
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={20}
        shadow-blurSamples={32}
      />
      <directionalLight
        ref={frontRef}
        position={[2, 5, 14]}
        color="#ffffff"
        intensity={0}
        castShadow
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

function FireLight({ menuOpen }: { menuOpen: boolean }) {
  const introStartMs = useContext(IntroStartContext)
  const ref = useRef<PointLight>(null)
  const menuScale = useRef(1)

  useFrame((_, delta) => {
    if (!ref.current) return
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

function AnimatedBoard({ children, menuOpen }: { children: React.ReactNode; menuOpen: boolean }) {
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
    flipProgress.current += (target - flipProgress.current) * Math.min(delta * 4, 1)
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

const TOP_DOWN_CAM = new Vector3(0, 22, 0.01)

function CameraLock({ locked }: { locked: boolean }) {
  useFrame(({ camera, controls }) => {
    if (!locked) return
    camera.position.lerp(TOP_DOWN_CAM, 0.06)
    if (controls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = controls as any
      c.target.lerp(DEFAULT_CAM_TARGET, 0.06)
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
  const { pieces, selectedId, theme: themeName, selectPiece, cameraLocked } = useGameStore()
  const theme = themes[themeName]
  const [menuPhase, setMenuPhase] = useState<MenuPhase>('idle')
  // boardFlipOpen is delayed: pieces hide first, THEN board flips
  const [boardFlipOpen, setBoardFlipOpen] = useState(false)
  // lights cut immediately on open, restored only after board has returned
  const [lightsOn, setLightsOn] = useState(true)
  const everOpened = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  useEffect(() => {
    clearTimers()
    if (menuOpen) {
      everOpened.current = true
      setLightsOn(false)
      setMenuPhase('hiding')
      // Step 2: after pieces are gone, start board flip
      timers.current.push(setTimeout(() => {
        setMenuPhase('hidden')
        setBoardFlipOpen(true)
      }, HIDE_MS))
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
      <FadingLights menuOpen={!lightsOn} />
      <FireLight menuOpen={!lightsOn} />
      <AnimatedBoard menuOpen={boardFlipOpen}>
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
      <CameraReset menuOpen={menuOpen} />
      <CameraLock locked={cameraLocked && !menuOpen} />
      <OrbitControls
        makeDefault
        enabled={!menuOpen && !cameraLocked}
        enablePan={false}
        minDistance={6}
        maxDistance={32}
        minPolarAngle={cameraLocked ? Math.PI * 0.01 : 0.3}
        maxPolarAngle={cameraLocked ? Math.PI * 0.01 : Math.PI / 2.2}
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

  const tryStartFade = () => {
    if (minHoldMet.current && loadingDone.current) {
      setPhase('fading')
      setTimeout(() => {
        setPhase('done')
        onDone()
      }, 1000)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      minHoldMet.current = true
      tryStartFade()
    }, 1000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!active && phase === 'loading') {
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
