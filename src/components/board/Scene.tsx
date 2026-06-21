import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Board } from './Board'
import { Piece } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { themes } from '../../lib/themes'

function SceneInner() {
  const { pieces, selectedId, theme: themeName, selectPiece } = useGameStore()
  const theme = themes[themeName]

  return (
    <>
      <fog attach="fog" args={["#0a0800", 20, 38]} />

      {/* Cool ambient — moonlit fill, barely there */}
      <ambientLight color="#b0c8e8" intensity={0.5} />

      {/* Main moonlight — cool blue-white, high angle from one side */}
      <directionalLight
        position={[-6, 14, 6]}
        color="#d8eaff"
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={8}
        shadow-blurSamples={16}
      />

      {/* Soft secondary fill from opposite side so shadows aren't totally black */}
      <directionalLight position={[8, 6, -4]} color="#c0d8f0" intensity={0.6} />

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
