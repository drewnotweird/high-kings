import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { BOARD_SIZE, isCorner, isThrone } from '../../game/hnefatafl'
import type { ThemeConfig } from '../../lib/themes'

const SQUARE_SIZE = 0.88
const TILE_HEIGHT = 0.12
const BEVEL = 0.04
const BOARD_OFFSET = (BOARD_SIZE - 1) / 2

interface BoardProps {
  theme: ThemeConfig
}

export function Board({ theme }: BoardProps) {
  const squares = useMemo(() => {
    const result = []
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const x = col - BOARD_OFFSET
        const z = row - BOARD_OFFSET
        const isLight = (row + col) % 2 === 0
        let color = isLight ? theme.lightSquareColor : theme.darkSquareColor
        if (isCorner(row, col)) color = theme.cornerColor
        if (isThrone(row, col)) color = theme.throneColor
        result.push({ row, col, x, z, color })
      }
    }
    return result
  }, [theme])

  return (
    <group>
      {/* Board base slab */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[BOARD_SIZE + 1.2, 0.3, BOARD_SIZE + 1.2]} />
        <meshStandardMaterial
          color={theme.boardEdgeColor}
          roughness={theme.boardRoughness}
          metalness={theme.boardMetalness}
        />
      </mesh>

      {/* Grid squares */}
      {squares.map(({ row, col, x, z, color }) => (
        <RoundedBox
          key={`${row}-${col}`}
          args={[SQUARE_SIZE, TILE_HEIGHT, SQUARE_SIZE]}
          radius={BEVEL}
          smoothness={4}
          position={[x, 0, z]}
          receiveShadow
        >
          <meshStandardMaterial
            color={color}
            roughness={theme.boardRoughness}
            metalness={theme.boardMetalness}
          />
        </RoundedBox>
      ))}

      {/* Corner markers — small raised rune stones */}
      {[[0,0],[0,10],[10,0],[10,10]].map(([r, c]) => (
        <mesh
          key={`corner-${r}-${c}`}
          position={[c - BOARD_OFFSET, 0.06, r - BOARD_OFFSET]}
          receiveShadow
        >
          <cylinderGeometry args={[0.3, 0.35, 0.12, 6]} />
          <meshStandardMaterial
            color={theme.cornerColor}
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* Throne marker */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.32, 0.38, 0.12, 8]} />
        <meshStandardMaterial
          color={theme.throneColor}
          roughness={0.6}
          metalness={0.15}
        />
      </mesh>
    </group>
  )
}
