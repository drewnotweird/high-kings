import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, useProgress } from '@react-three/drei'
import { PointLight, DirectionalLight, SpotLight, AmbientLight, Group } from 'three'
import { Board } from './Board'
import { Piece } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { themes } from '../../lib/themes'

const BOARD_ARRIVE = 1.2
const PIECE_STAGGER = 0.07
const BOARD_DURATION = 1.1  // slightly slower rise
const BOARD_START_Y = -20   // start further below

function FadingLights() {
  const ambientRef = useRef<AmbientLight>(null)
  const moonRef = useRef<DirectionalLight>(null)
  const spotRef = useRef<SpotLight>(null)
  const frontRef = useRef<DirectionalLight>(null)
  const bounceRef = useRef<PointLight>(null)
  const backRef = useRef<PointLight>(null)
  const fireBaseRef = useRef<PointLight>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Fade in over ~1.4s, slightly delayed so board rises in near-darkness
    const fade = Math.min(Math.max((t - 0.3) / 1.4, 0), 1)
    const e = 1 - Math.pow(1 - fade, 2) // ease-out quad

    if (ambientRef.current)  ambientRef.current.intensity  = 0.02 * e
    if (moonRef.current)     moonRef.current.intensity     = 0.25 * e
    if (spotRef.current)     spotRef.current.intensity     = 20   * e
    if (frontRef.current)    frontRef.current.intensity    = 0.2  * e
    if (bounceRef.current)   bounceRef.current.intensity   = 5    * e
    if (backRef.current)     backRef.current.intensity     = 3    * e
    if (fireBaseRef.current) fireBaseRef.current.intensity = 5    * e
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
      <pointLight ref={fireBaseRef} position={[0, -1, 2]} color="#c85010" intensity={0} distance={22} decay={1.8} />
      <pointLight ref={backRef} position={[0, 9, -16]} color="#7090c0" intensity={0} distance={32} decay={1.8} />
    </>
  )
}

function FireLight() {
  const ref = useRef<PointLight>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    const fade = Math.min(Math.max((t - 0.3) / 1.4, 0), 1)
    const e = 1 - Math.pow(1 - fade, 2)
    const flicker = 1 + 0.35 * Math.sin(t * 7.3) + 0.2 * Math.sin(t * 13.1) + 0.1 * Math.sin(t * 3.7)
    ref.current.intensity = 6 * flicker * e
  })
  return <pointLight ref={ref} position={[0, -0.5, 3]} color="#ff6010" distance={20} decay={2} intensity={0} />
}

function AnimatedBoard({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<Group>(null)
  const done = useRef(false)

  useFrame(({ clock }) => {
    if (!groupRef.current || done.current) return
    const t = clock.getElapsedTime()
    const progress = Math.min(t / BOARD_DURATION, 1)
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3)
    groupRef.current.position.y = BOARD_START_Y + (-BOARD_START_Y) * eased
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
    ...pieces.filter(p => p.type === 'attacker'),
    ...pieces.filter(p => p.type === 'defender'),
    ...pieces.filter(p => p.type === 'king'),
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
        maxDistance={20}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0, 0]}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  )
}

function LoadingOverlay() {
  const { active } = useProgress()
  if (!active) return null
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
    }}>
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="High Kings"
        style={{ height: 128, width: 'auto', opacity: 0.85, animation: 'fireFlicker 1.8s ease-in-out infinite' }}
      />
    </div>
  )
}

export function Scene() {
  return (
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
      <LoadingOverlay />
    </div>
  )
}
