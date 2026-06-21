import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { Board } from './Board'
import { Piece } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { themes } from '../../lib/themes'

function SceneInner() {
  const { pieces, selectedId, theme: themeName, selectPiece } = useGameStore()
  const theme = themes[themeName]

  return (
    <>
      <fog attach="fog" args={["#0a0800", 18, 36]} />

      <Environment preset="night" environmentIntensity={0.4} />
      <ambientLight color="#9ab0c8" intensity={0.2} />

      {/* Moon — cool directional from high above, slight angle */}
      <directionalLight
        position={[-3, 20, 5]}
        color="#c8dff8"
        intensity={0.9}
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

      {/* Soft spotlight — centred on the board, wide and very soft penumbra */}
      <spotLight
        position={[0, 20, 4]}
        target-position={[0, 0, 0]}
        color="#e8f0ff"
        intensity={22}
        distance={40}
        angle={0.32}
        penumbra={1.0}
        decay={1.0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={20}
        shadow-blurSamples={32}
      />

      {/* Warm bounce from below — firelight off the board */}
      <pointLight position={[0, -1, 2]} color="#b86820" intensity={4} distance={18} decay={2} />

      {/* Cool rim from behind */}
      <pointLight position={[0, 6, -14]} color="#6888a8" intensity={6} distance={28} decay={2} />

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
