import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, useProgress } from '@react-three/drei'
import { PointLight, Group } from 'three'
import { Board } from './Board'
import { Piece } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { themes } from '../../lib/themes'

const BOARD_ARRIVE = 0.9
const PIECE_STAGGER = 0.07

function FireLight() {
  const ref = useRef<PointLight>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    const flicker = 1 + 0.35 * Math.sin(t * 7.3) + 0.2 * Math.sin(t * 13.1) + 0.1 * Math.sin(t * 3.7)
    ref.current.intensity = 6 * flicker
  })
  return <pointLight ref={ref} position={[0, -0.5, 3]} color="#ff6010" distance={20} decay={2} />
}

function AnimatedBoard({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<Group>(null)
  const done = useRef(false)

  useFrame(({ clock }) => {
    if (!groupRef.current || done.current) return
    const t = clock.getElapsedTime()
    const progress = Math.min(t / 0.8, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    groupRef.current.position.y = -14 + 14 * eased
    if (progress >= 1) done.current = true
  })

  return (
    <group ref={groupRef} position={[0, -14, 0]}>
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
      <ambientLight color="#9ab0c8" intensity={0.02} />

      <directionalLight
        position={[-3, 20, 5]}
        color="#c8dff8"
        intensity={0.25}
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
        position={[0, 20, 4]}
        target-position={[0, 0, 0]}
        color="#e8f0ff"
        intensity={20}
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
        position={[2, 5, 14]}
        color="#ffffff"
        intensity={0.2}
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
      <pointLight position={[0, -1, 2]} color="#c85010" intensity={5} distance={22} decay={1.8} />
      <FireLight />
      <pointLight position={[0, 9, -16]} color="#7090c0" intensity={3} distance={32} decay={1.8} />

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
