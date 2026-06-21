import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { PointLight } from 'three'
import { Board } from './Board'
import { Piece } from '../pieces/Piece'
import { useGameStore } from '../../store/gameStore'
import { themes } from '../../lib/themes'
import type { ThemeConfig } from '../../lib/themes'

function FireLight({ theme }: { theme: ThemeConfig }) {
  const lightRef = useRef<PointLight>(null)

  useFrame(({ clock }) => {
    if (!lightRef.current) return
    const t = clock.getElapsedTime()
    lightRef.current.intensity =
      theme.fireIntensity + Math.sin(t * 7.3) * 0.3 + Math.sin(t * 13.1) * 0.15
    lightRef.current.position.x = Math.sin(t * 1.1) * 0.3
    lightRef.current.position.z = Math.cos(t * 0.9) * 0.3
  })

  return (
    <pointLight
      ref={lightRef}
      position={[0, 4, 0]}
      color={theme.fireColor}
      intensity={theme.fireIntensity}
      distance={24}
      decay={1.5}
      castShadow
    />
  )
}

function SceneInner() {
  const { pieces, selectedId, theme: themeName, selectPiece } = useGameStore()
  const theme = themes[themeName]

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />

      <ambientLight color={theme.ambientColor} intensity={theme.ambientIntensity} />
      <FireLight theme={theme} />

      {/* Fill lights around the board edges */}
      <pointLight position={[-7, 2, 0]} color={theme.fireColor} intensity={2} distance={16} decay={2} />
      <pointLight position={[7, 2, 0]} color={theme.fireColor} intensity={2} distance={16} decay={2} />
      <pointLight position={[0, 2, -7]} color={theme.fireColor} intensity={2} distance={16} decay={2} />
      <pointLight position={[0, 2, 7]} color={theme.fireColor} intensity={1.5} distance={16} decay={2} />

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
  const { theme: themeName } = useGameStore()
  const theme = themes[themeName]

  return (
    <Canvas
      shadows
      camera={{ position: [0, 12, 14], fov: 45 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: theme.background }}
    >
      <SceneInner />
    </Canvas>
  )
}
