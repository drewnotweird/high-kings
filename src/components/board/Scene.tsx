import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { PointLight } from 'three'
import { Board } from './Board'
import { Piece } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { themes } from '../../lib/themes'

function FireLight() {
  const ref = useRef<PointLight>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    // Layered sin waves for irregular flicker
    const flicker = 1 + 0.35 * Math.sin(t * 7.3) + 0.2 * Math.sin(t * 13.1) + 0.1 * Math.sin(t * 3.7)
    ref.current.intensity = 6 * flicker
  })
  return <pointLight ref={ref} position={[0, -0.5, 3]} color="#ff6010" distance={20} decay={2} />
}

function SceneInner() {
  const { pieces, selectedId, theme: themeName, selectPiece } = useGameStore()
  const theme = themes[themeName]

  return (
    <>
      <fog attach="fog" args={["#0a0800", 18, 36]} />

      <Environment preset="night" environmentIntensity={0.0} />
      <ambientLight color="#9ab0c8" intensity={0.02} />

      {/* Moon — subtle fill only, not enough to flatten the shroud */}
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

      {/* Spotlight — primary source, creates the shroud by falling off at edges */}
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

      {/* Low front light — soft, just enough for piece shadows */}
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

      {/* Warm fire bounce — steady base */}
      <pointLight position={[0, -1, 2]} color="#c85010" intensity={5} distance={22} decay={1.8} />

      {/* Flickering fire light */}
      <FireLight />

      {/* Soft backlight */}
      <pointLight position={[0, 9, -16]} color="#7090c0" intensity={3} distance={32} decay={1.8} />

      <Board theme={theme} />

      {pieces.map((piece) => (
        <Piece
          key={piece.id}
          piece={piece}
          theme={theme}
          isSelected={selectedId === piece.id}
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

export function Scene() {
  return (
    <Canvas
      shadows={{ type: 2 }}
      camera={{ position: [0, 12, 14], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <SceneInner />
    </Canvas>
  )
}
