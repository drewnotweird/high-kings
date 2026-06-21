import { useRef, Suspense, useState, useEffect, useContext } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, useProgress } from '@react-three/drei'
import { PointLight, DirectionalLight, SpotLight, AmbientLight, Group } from 'three'
import { Board } from './Board'
import { Piece } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { themes } from '../../lib/themes'
import { IntroStartContext } from '../../contexts/intro'

const BOARD_ARRIVE = 1.2
const PIECE_STAGGER = 0.07
const BOARD_DURATION = 1.1
const BOARD_START_Y = -20

function FadingLights() {
  const introStartMs = useContext(IntroStartContext)
  const ambientRef = useRef<AmbientLight>(null)
  const moonRef = useRef<DirectionalLight>(null)
  const spotRef = useRef<SpotLight>(null)
  const frontRef = useRef<DirectionalLight>(null)
  const bounceRef = useRef<PointLight>(null)
  const backRef = useRef<PointLight>(null)

  useFrame(() => {
    const t = introStartMs ? (Date.now() - introStartMs) / 1000 : -1
    const f = (start: number, dur: number) => 1 - Math.pow(1 - Math.min(Math.max((t - start) / dur, 0), 1), 2)

    if (ambientRef.current)  ambientRef.current.intensity  = 0.02 * f(0.0, 0.5)
    if (moonRef.current)     moonRef.current.intensity     = 0.25 * f(0.3, 0.5)
    if (spotRef.current)     spotRef.current.intensity     = 20   * f(0.6, 0.5)
    if (frontRef.current)    frontRef.current.intensity    = 0.2  * f(0.9, 0.4)

    const late = f(BOARD_DURATION, 1.2)
    if (bounceRef.current)   bounceRef.current.intensity   = 5 * late
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

function FireLight() {
  const introStartMs = useContext(IntroStartContext)
  const ref = useRef<PointLight>(null)
  useFrame(() => {
    if (!ref.current) return
    const t = introStartMs ? (Date.now() - introStartMs) / 1000 : -1
    const fade = Math.min(Math.max((t - BOARD_DURATION) / 1.2, 0), 1)
    const e = 1 - Math.pow(1 - fade, 2)
    const now = Date.now() / 1000
    const flicker = 1 + 0.35 * Math.sin(now * 7.3) + 0.2 * Math.sin(now * 13.1) + 0.1 * Math.sin(now * 3.7)
    ref.current.intensity = 6 * flicker * e
  })
  return <pointLight ref={ref} position={[0, -0.5, 3]} color="#ff6010" distance={20} decay={2} intensity={0} />
}

function AnimatedBoard({ children }: { children: React.ReactNode }) {
  const introStartMs = useContext(IntroStartContext)
  const groupRef = useRef<Group>(null)
  const done = useRef(false)

  useFrame(() => {
    if (!groupRef.current || done.current) return
    const t = introStartMs ? (Date.now() - introStartMs) / 1000 : -1
    if (t < 0) {
      groupRef.current.position.y = BOARD_START_Y
      return
    }
    const progress = Math.min(t / BOARD_DURATION, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    groupRef.current.position.y = BOARD_START_Y + (-BOARD_START_Y) * eased
    groupRef.current.rotation.x = (1 - eased) * -1.2
    if (progress >= 1) done.current = true
  })

  return (
    <group ref={groupRef} position={[0, BOARD_START_Y, 0]}>
      {children}
    </group>
  )
}

function SceneInner() {
  const { pieces, selectedId, theme: themeName, selectPiece } = useGameStore()
  const theme = themes[themeName]

  const ordered = [
    ...pieces.filter(p => p.type === 'king'),
    ...pieces.filter(p => p.type === 'defender'),
    ...pieces.filter(p => p.type === 'attacker'),
  ]
  const delayMap = new Map(ordered.map((p, i) => [p.id, BOARD_ARRIVE + i * PIECE_STAGGER]))

  return (
    <>
      <fog attach="fog" args={["#0a0800", 18, 36]} />
      <Environment preset="night" environmentIntensity={0.0} />
      <FadingLights />
      <FireLight />
      <AnimatedBoard>
        <Board theme={theme} />
      </AnimatedBoard>
      {pieces.map((piece) => (
        <Piece
          key={piece.id}
          piece={piece}
          theme={theme}
          isSelected={selectedId === piece.id}
          dropDelay={delayMap.get(piece.id) ?? BOARD_ARRIVE}
          onClick={() => selectPiece(selectedId === piece.id ? null : piece.id)}
        />
      ))}
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={32}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.2}
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

  // Minimum 1s hold
  useEffect(() => {
    const t = setTimeout(() => {
      minHoldMet.current = true
      tryStartFade()
    }, 1000)
    return () => clearTimeout(t)
  }, [])

  // Wait for textures
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

export function Scene({ onIntroStart }: { onIntroStart?: () => void }) {
  const [introStartMs, setIntroStartMs] = useState<number | null>(null)

  return (
    <IntroStartContext.Provider value={introStartMs}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Canvas
          shadows={{ type: 2 }}
          camera={{ position: [0, 12, 14], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <SceneInner />
          </Suspense>
        </Canvas>
        <LoadingOverlay onDone={() => { setIntroStartMs(Date.now()); onIntroStart?.() }} />
      </div>
    </IntroStartContext.Provider>
  )
}
