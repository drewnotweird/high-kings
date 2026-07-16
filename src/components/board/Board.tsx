import { useMemo, useRef, useEffect, useLayoutEffect, useState } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { ClampToEdgeWrapping, Shape, ExtrudeGeometry, Vector2, Mesh, MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, BufferGeometry, CanvasTexture, SRGBColorSpace } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ThreeEvent } from '@react-three/fiber'
import { getBoardConfig, isCorner, isThrone, isValidMove } from '../../game/hnefatafl'
import { useGameSlice } from '../../store/gameStore'
import type { ThemeConfig } from '../../lib/themes'

const SQUARE_SIZE = 0.88
const TILE_HEIGHT = 0.055
const CORNER_RADIUS = 0.05
const BEVEL = 0.038
const TILE_TOP = TILE_HEIGHT + BEVEL
const TILE_COUNT = 10
const HALF = SQUARE_SIZE / 2

// Tile atlas layout: cells 0-9 = tile-1..10, cell 10 = tile-11 (corner/throne face)
const ATLAS_CELL = 256
const ATLAS_COLS = 4
const ATLAS_ROWS = 3
const ATLAS_PAD = 10 // px inset per cell edge — bleed guard for filtering/mipmaps
const OVERLAY_ORDER = ['corner', 'throne', 'defender', 'attacker'] as const

// Remap a geometry's 0..1 UVs into one padded atlas cell, rotating in 90° steps.
// Matches the old per-texture `texture.rotation = rotIdx * PI/2` behaviour.
function remapUVsToAtlasCell(
  geo: BufferGeometry, cellIdx: number, rotIdx: number, cols: number, rows: number
) {
  const uv = geo.attributes.uv
  const cellCol = cellIdx % cols
  // Canvas rows count from the top; UV v counts from the bottom (flipY)
  const cellRow = rows - 1 - Math.floor(cellIdx / cols)
  const inner = (ATLAS_CELL - 2 * ATLAS_PAD) / ATLAS_CELL
  const pad = ATLAS_PAD / ATLAS_CELL
  for (let i = 0; i < uv.count; i++) {
    let u = Math.min(Math.max(uv.getX(i), 0), 1)
    let v = Math.min(Math.max(uv.getY(i), 0), 1)
    for (let r = 0; r < rotIdx; r++) { const t = u; u = v; v = 1 - t }
    uv.setXY(i, (cellCol + pad + u * inner) / cols, (cellRow + pad + v * inner) / rows)
  }
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Custom UV generator so tile texture is centred and fills the top face 0→1
const uvGenerator = {
  generateTopUV(_: unknown, vertices: number[], iA: number, iB: number, iC: number) {
    const toUV = (x: number, y: number) =>
      new Vector2((x + HALF) / SQUARE_SIZE, (y + HALF) / SQUARE_SIZE)
    return [
      toUV(vertices[iA * 3], vertices[iA * 3 + 1]),
      toUV(vertices[iB * 3], vertices[iB * 3 + 1]),
      toUV(vertices[iC * 3], vertices[iC * 3 + 1]),
    ]
  },
  generateSideWallUV(_: unknown, vertices: number[], iA: number, iB: number, iC: number, iD: number) {
    const az = vertices[iA * 3 + 2], bz = vertices[iB * 3 + 2]
    const cz = vertices[iC * 3 + 2], dz = vertices[iD * 3 + 2]
    const ax = vertices[iA * 3],     bx = vertices[iB * 3]
    const cx = vertices[iC * 3],     dx = vertices[iD * 3]
    return [
      new Vector2(ax, az / TILE_HEIGHT),
      new Vector2(bx, bz / TILE_HEIGHT),
      new Vector2(cx, cz / TILE_HEIGHT),
      new Vector2(dx, dz / TILE_HEIGHT),
    ]
  },
}

interface BoardProps {
  theme: ThemeConfig
  menuPhase?: 'idle' | 'hiding' | 'hidden' | 'appearing'
}

const phaseCache = new Map<string, number>()
export function clearPhaseCache() { phaseCache.clear() }
function getPhase(row: number, col: number) {
  const key = `${row},${col}`
  if (!phaseCache.has(key)) phaseCache.set(key, Math.random() * Math.PI * 2)
  return phaseCache.get(key)!
}

function ValidMoveMarker({ x, z, row, col, appearDelay, disappearing = false, disappearDelay = 0, caution = false, onHover, onUnhover, tileHovered = false, dimmed = false }: {
  x: number; z: number; row: number; col: number; appearDelay: number
  disappearing?: boolean; disappearDelay?: number; caution?: boolean
  onHover?: () => void; onUnhover?: () => void
  tileHovered?: boolean; dimmed?: boolean
}) {
  const meshRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const matRef = useRef<MeshStandardMaterial>(null)
  const { movePiece, powerSaving } = useGameSlice('movePiece', 'powerSaving')
  const phase = getPhase(row, col)
  const birthTime = useRef(0)
  const sinkY = useRef(0)
  const dimScale = useRef(1)
  const dimOpacity = useRef(1)
  const { clock } = useThree()
  useEffect(() => { birthTime.current = clock.getElapsedTime() }, [])
  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    const elapsed = t - birthTime.current

    if (disappearing) {
      // Hold at full scale until disappearDelay, then shrink over 120ms
      const s = elapsed < disappearDelay ? 1 : Math.max(0, 1 - Math.min((elapsed - disappearDelay) / 0.12, 1))
      meshRef.current.scale.setScalar(s)
      if (glowRef.current) glowRef.current.scale.setScalar(s)
    } else {
      if (elapsed < appearDelay) {
        meshRef.current.scale.setScalar(0)
        if (glowRef.current) glowRef.current.scale.setScalar(0)
        return
      }
      // Quick elastic pop-in over 120ms
      const p = Math.min((elapsed - appearDelay) / 0.12, 1)
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p
      const overshoot = p >= 1 ? 1 : ease * 1.25 - 0.25 * ease * ease
      const s = Math.max(0, Math.min(overshoot, 1.15 - 0.15 * p))
      meshRef.current.scale.setScalar(s)
      if (glowRef.current) glowRef.current.scale.setScalar(s)
    }

    if (powerSaving) return

    // Dim scale + opacity when another tile is hovered
    const targetDimScale = dimmed ? 0.6 : 1
    const targetDimOpacity = dimmed ? 0.35 : 1
    dimScale.current += (targetDimScale - dimScale.current) * Math.min(delta * 10, 1)
    dimOpacity.current += (targetDimOpacity - dimOpacity.current) * Math.min(delta * 10, 1)
    // Apply dim on top of current pop-in scale
    meshRef.current.scale.setScalar(meshRef.current.scale.x * dimScale.current)
    if (glowRef.current) glowRef.current.scale.setScalar(glowRef.current.scale.x * dimScale.current)

    // Bob gently — keep glow concentric with orb; sink when tile is hovered
    const sinkTarget = tileHovered ? -0.14 : 0
    sinkY.current += (sinkTarget - sinkY.current) * Math.min(delta * 12, 1)
    const bobY = TILE_TOP + 0.18 + Math.sin(t * 2.6 + phase) * 0.04 + sinkY.current
    meshRef.current.position.y = bobY
    if (glowRef.current) glowRef.current.position.y = bobY

    // Flicker emissive intensity + opacity
    if (matRef.current) {
      const flicker = 0.55 + 0.45 * Math.sin(t * 13.1 + phase * 3.7) * Math.sin(t * 8.3 + phase)
      matRef.current.emissiveIntensity = (0.35 + flicker * 0.3) * dimOpacity.current
      matRef.current.opacity = dimOpacity.current
    }
  })

  return (
    <group position={[x, TILE_TOP + 0.18, z]}>
      <mesh
        ref={meshRef}
        castShadow
        scale={0}
        onClick={disappearing ? undefined : (e) => { e.stopPropagation(); movePiece(row, col) }}
        onPointerEnter={disappearing ? undefined : (e) => { e.stopPropagation(); onHover?.() }}
        onPointerLeave={disappearing ? undefined : (e) => { e.stopPropagation(); onUnhover?.() }}
      >
        <sphereGeometry args={[0.13, 14, 10]} />
        <meshStandardMaterial
          ref={matRef}
          transparent
          color={caution ? "#e8c040" : powerSaving ? "#ff6600" : "#e8874a"}
          emissive={caution ? "#c89010" : powerSaving ? "#ff4400" : "#d45a10"}
          emissiveIntensity={powerSaving ? 0.9 : caution ? 0.6 : 0.4}
          roughness={0.9}
          metalness={0}
          opacity={0.85}
        />
      </mesh>
      {!powerSaving && (
        <mesh ref={glowRef} scale={0}>
          <sphereGeometry args={[0.26, 10, 8]} />
          <meshStandardMaterial
            color={caution ? "#e8c040" : "#ff4400"}
            emissive={caution ? "#e8c040" : "#ff4400"}
            emissiveIntensity={0.6}
            transparent
            opacity={0.12}
            depthWrite={false}
            side={2}
          />
        </mesh>
      )}
    </group>
  )
}

const hoverPlaneGeo = new PlaneGeometry(SQUARE_SIZE * 0.94, SQUARE_SIZE * 0.94)

function TileHoverGlow({ x, z, active }: { x: number; z: number; active: boolean }) {
  const meshRef = useRef<Mesh>(null)
  const matRef = useRef<MeshStandardMaterial>(null)
  const opRef = useRef(0)
  const posX = useRef(x)
  const posZ = useRef(z)

  useEffect(() => { posX.current = x; posZ.current = z }, [x, z])

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return
    meshRef.current.position.x = posX.current
    meshRef.current.position.z = posZ.current
    const target = active ? 0.45 : 0
    opRef.current += (target - opRef.current) * Math.min(delta * 16, 1)
    matRef.current.opacity = opRef.current
    meshRef.current.visible = opRef.current > 0.005
  })

  return (
    <mesh
      ref={meshRef}
      position={[x, TILE_TOP + 0.003, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={hoverPlaneGeo}
      visible={false}
    >
      <meshStandardMaterial
        ref={matRef}
        color="#ff8030"
        emissive="#ff5500"
        emissiveIntensity={1.4}
        transparent
        opacity={0}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  )
}

const MAX_PATH_TILES = 22 // enough for largest board (19×19)
const pathPlaneGeo = new PlaneGeometry(SQUARE_SIZE * 0.96, SQUARE_SIZE * 0.96)

function LastMovePathGlow({ path, boardOffset }: { path: [number, number][]; boardOffset: number }) {
  const meshRefs = useRef<(Mesh | null)[]>(Array(MAX_PATH_TILES).fill(null))
  const matRefs = useRef<(MeshBasicMaterial | null)[]>(Array(MAX_PATH_TILES).fill(null))
  const opacities = useRef<number[]>(Array(MAX_PATH_TILES).fill(0))

  useFrame((_, delta) => {
    for (let i = 0; i < MAX_PATH_TILES; i++) {
      const mesh = meshRefs.current[i]
      const mat = matRefs.current[i]
      if (!mesh || !mat) continue
      const inPath = i < path.length
      const target = inPath ? 0.28 : 0
      // Snap position before fading in from invisible so we don't see a ghost
      if (inPath && opacities.current[i] < 0.01) {
        mesh.position.x = path[i][1] - boardOffset
        mesh.position.z = path[i][0] - boardOffset
      }
      opacities.current[i] += (target - opacities.current[i]) * Math.min(delta * 7, 1)
      mat.opacity = opacities.current[i]
      mesh.visible = opacities.current[i] > 0.004
    }
  })

  return (
    <>
      {Array.from({ length: MAX_PATH_TILES }, (_, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el }}
          position={[0, TILE_TOP + 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={pathPlaneGeo}
          visible={false}
        >
          <meshBasicMaterial
            ref={el => { matRefs.current[i] = el }}
            color="#d4a830"
            transparent
            opacity={0}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}
    </>
  )
}

export function Board({ theme, menuPhase }: BoardProps) {
  const { rules, boardSize: storedBoardSize, pieces, validMoves, cautionMoves, selectedId, selectPiece, movePiece, gameKey, powerSaving, lastMovePath } = useGameSlice('rules', 'boardSize', 'pieces', 'validMoves', 'cautionMoves', 'selectedId', 'selectPiece', 'movePiece', 'gameKey', 'powerSaving', 'lastMovePath')
  const { boardSize, center, attackerStarts, defenderStarts, kingEscapeEdge } = getBoardConfig(rules, storedBoardSize)
  useEffect(() => { clearPhaseCache() }, [gameKey])
  const [hoveredTile, setHoveredTile] = useState<{ x: number; z: number } | null>(null)
  const boardOffset = (boardSize - 1) / 2
  const selectedPiece = pieces.find(p => p.id === selectedId)

  // Track departing orbs so they can animate out in reverse order
  type LeavingMarker = { row: number; col: number; x: number; z: number; disappearDelay: number }
  const [leavingMarkers, setLeavingMarkers] = useState<LeavingMarker[]>([])
  const prevValidMoves = useRef<[number,number][]>([])
  const prevSelectedPiece = useRef<typeof pieces[0] | undefined>(undefined)
  const leavingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (leavingTimer.current) clearTimeout(leavingTimer.current) }, [])

  useLayoutEffect(() => {
    const prev = prevValidMoves.current
    const prevPiece = prevSelectedPiece.current
    if (prev.length > 0) {
      const withDist = prev.map(([r, c]) => ({
        row: r, col: c,
        x: c - boardOffset, z: r - boardOffset,
        dist: prevPiece ? Math.max(Math.abs(r - prevPiece.row), Math.abs(c - prevPiece.col)) : 0,
      }))
      const maxDist = Math.max(...withDist.map(m => m.dist), 0)
      const leaving = withDist.map(m => ({
        row: m.row, col: m.col, x: m.x, z: m.z,
        disappearDelay: (maxDist - m.dist) * 0.028,
      }))
      setLeavingMarkers(leaving)
      if (leavingTimer.current) clearTimeout(leavingTimer.current)
      leavingTimer.current = setTimeout(
        () => setLeavingMarkers([]),
        (maxDist * 0.028 + 0.2) * 1000
      )
    }
    prevValidMoves.current = validMoves
    prevSelectedPiece.current = selectedPiece
  }, [validMoves])

  const tileGeometry = useMemo(() => {
    const r = CORNER_RADIUS
    const h = HALF - r
    const shape = new Shape()
    shape.moveTo(-h, -HALF)
    shape.lineTo(h, -HALF)
    shape.quadraticCurveTo(HALF, -HALF, HALF, -h)
    shape.lineTo(HALF, h)
    shape.quadraticCurveTo(HALF, HALF, h, HALF)
    shape.lineTo(-h, HALF)
    shape.quadraticCurveTo(-HALF, HALF, -HALF, h)
    shape.lineTo(-HALF, -h)
    shape.quadraticCurveTo(-HALF, -HALF, -h, -HALF)
    shape.closePath()

    const geo = new ExtrudeGeometry(shape, {
      depth: TILE_HEIGHT,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 6,
      UVGenerator: uvGenerator,
    })
    return geo
  }, [])

  const tileAssignment = useMemo(() => {
    const map: Record<string, number> = {}
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const rand = mulberry32(row * 100 + col + 7)
        map[`${row},${col}`] = 1 + Math.floor(rand() * TILE_COUNT)
      }
    }
    return map
  }, [boardSize])

  const tileRotation = useMemo(() => {
    const map: Record<string, number> = {}
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const rand = mulberry32(row * 200 + col + 13)
        map[`${row},${col}`] = Math.floor(rand() * 4)
      }
    }
    return map
  }, [boardSize])

  const tilePaths = Array.from({ length: TILE_COUNT }, (_, i) => `${import.meta.env.BASE_URL}textures/tile-${i + 1}.webp`)
  const tileTextures = useTexture([...tilePaths, `${import.meta.env.BASE_URL}textures/tile-11.webp`])

  const boardTexture = useTexture(`${import.meta.env.BASE_URL}textures/board-edge.webp`)

  const overlays = useTexture({
    corner:   `${import.meta.env.BASE_URL}textures/tile-corner.webp`,
    throne:   `${import.meta.env.BASE_URL}textures/tile-throne.webp`,
    defender: `${import.meta.env.BASE_URL}textures/tile-defender.webp`,
    attacker: `${import.meta.env.BASE_URL}textures/tile-attacker.webp`,
  })

  // Pack the 11 tile textures into one atlas so the whole board top is a single
  // material / draw call. Per-square variant + rotation is baked into the merged
  // geometry's UVs (see mergedTileGeo) instead of 44 rotated texture clones.
  const tileAtlas = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = ATLAS_CELL * ATLAS_COLS
    canvas.height = ATLAS_CELL * ATLAS_ROWS
    const ctx = canvas.getContext('2d')!
    tileTextures.forEach((t, i) => {
      const col = i % ATLAS_COLS
      const row = Math.floor(i / ATLAS_COLS)
      ctx.drawImage(t.image as CanvasImageSource, col * ATLAS_CELL, row * ATLAS_CELL, ATLAS_CELL, ATLAS_CELL)
    })
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.wrapS = tex.wrapT = ClampToEdgeWrapping
    return tex
  }, [tileTextures])

  const overlayAtlas = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = ATLAS_CELL * 2
    canvas.height = ATLAS_CELL * 2
    const ctx = canvas.getContext('2d')!
    OVERLAY_ORDER.forEach((name, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      ctx.drawImage(overlays[name].image as CanvasImageSource, col * ATLAS_CELL, row * ATLAS_CELL, ATLAS_CELL, ATLAS_CELL)
    })
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.wrapS = tex.wrapT = ClampToEdgeWrapping
    return tex
  }, [overlays])
  useEffect(() => () => { tileAtlas.dispose(); overlayAtlas.dispose() }, [tileAtlas, overlayAtlas])

  const squares = useMemo(() => {
    const attackerSet = new Set(attackerStarts.map(([r, c]) => `${r},${c}`))
    const defenderSet = new Set(defenderStarts.map(([r, c]) => `${r},${c}`))
    const last = boardSize - 1
    const isEscapeSquare = (row: number, col: number) =>
      kingEscapeEdge
        ? (row === 0 || row === last || col === 0 || col === last)
        : isCorner(row, col, boardSize)
    const result = []
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const key = `${row},${col}`
        const x = col - boardOffset
        const z = row - boardOffset
        const variantIdx = (tileAssignment[key] ?? 1) - 1
        const rotIdx = tileRotation[key] ?? 0

        let overlay: 'corner' | 'throne' | 'defender' | 'attacker' | null = null
        if (isEscapeSquare(row, col)) overlay = 'corner'
        else if (isThrone(row, col, center)) overlay = 'throne'
        else if (defenderSet.has(key)) overlay = 'defender'
        else if (attackerSet.has(key)) overlay = 'attacker'

        result.push({ row, col, x, z, variantIdx, rotIdx, overlay, isCornerTile: isEscapeSquare(row, col) || isThrone(row, col, center) })
      }
    }
    return result
  }, [boardSize, boardOffset, center, attackerStarts, defenderStarts, tileAssignment, tileRotation, kingEscapeEdge])

  // All board tiles merged into a single geometry (one draw call), with each
  // square's variant/rotation baked into its UVs against the tile atlas
  const mergedTileGeo = useMemo(() => {
    const geos = squares.map(({ x, z, variantIdx, rotIdx, isCornerTile }) => {
      const g = tileGeometry.clone()
      remapUVsToAtlasCell(g, isCornerTile ? TILE_COUNT : variantIdx, isCornerTile ? 0 : rotIdx, ATLAS_COLS, ATLAS_ROWS)
      g.rotateX(-Math.PI / 2)
      g.translate(x, 0, z)
      return g
    })
    const merged = mergeGeometries(geos)
    geos.forEach(g => g.dispose())
    return merged
  }, [squares, tileGeometry])

  // Corner/throne/start-square markings — one merged transparent plane layer
  const mergedOverlayGeo = useMemo(() => {
    const geos = squares.filter(s => s.overlay).map(({ x, z, overlay }) => {
      const g = new PlaneGeometry(SQUARE_SIZE * 0.96, SQUARE_SIZE * 0.96)
      remapUVsToAtlasCell(g, OVERLAY_ORDER.indexOf(overlay!), 0, 2, 2)
      g.rotateX(-Math.PI / 2)
      g.translate(x, TILE_TOP + 0.003, z)
      return g
    })
    if (geos.length === 0) return null
    const merged = mergeGeometries(geos)
    geos.forEach(g => g.dispose())
    return merged
  }, [squares])

  useEffect(() => () => { mergedTileGeo.dispose(); mergedOverlayGeo?.dispose() }, [mergedTileGeo, mergedOverlayGeo])

  // Single set of pointer handlers for the whole board — square is derived
  // from the intersection point instead of 361 per-tile handlers
  const boardMeshRef = useRef<Mesh>(null)
  const pointToSquare = (e: ThreeEvent<MouseEvent>) => {
    const mesh = boardMeshRef.current
    if (!mesh) return null
    const local = mesh.worldToLocal(e.point.clone())
    const col = Math.round(local.x + boardOffset)
    const row = Math.round(local.z + boardOffset)
    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return null
    return { row, col, x: col - boardOffset, z: row - boardOffset }
  }

  const handleBoardClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const sq = pointToSquare(e)
    if (!sq) return
    if (isValidMove(sq.row, sq.col, validMoves)) {
      movePiece(sq.row, sq.col)
    } else {
      const pieceHere = pieces.find(p => p.row === sq.row && p.col === sq.col && p.type !== 'king')
      if (pieceHere) selectPiece(pieceHere.id)
      else if (selectedId) selectPiece(null)
    }
  }

  const handleBoardPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (powerSaving) return
    const sq = pointToSquare(e)
    const next = sq && isValidMove(sq.row, sq.col, validMoves) ? { x: sq.x, z: sq.z } : null
    setHoveredTile(prev => (prev?.x === next?.x && prev?.z === next?.z) ? prev : next)
  }

  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[boardSize + 1.2, 0.3, boardSize + 1.2]} />
        <meshStandardMaterial
          map={boardTexture}
          roughness={theme.boardRoughness}
          metalness={theme.boardMetalness}
        />
      </mesh>

      <mesh
        ref={boardMeshRef}
        geometry={mergedTileGeo}
        receiveShadow
        onClick={handleBoardClick}
        onPointerMove={handleBoardPointerMove}
        onPointerLeave={() => setHoveredTile(null)}
      >
        <meshStandardMaterial
          map={tileAtlas}
          roughness={theme.boardRoughness}
          metalness={theme.boardMetalness}
        />
      </mesh>

      {mergedOverlayGeo && (
        <mesh geometry={mergedOverlayGeo}>
          <meshStandardMaterial
            map={overlayAtlas}
            transparent
            alphaTest={0.1}
            roughness={0.8}
            metalness={0}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}

      {!menuPhase?.match(/hiding|hidden/) && validMoves.map(([row, col]) => {
        const x = col - boardOffset
        const z = row - boardOffset
        const dist = selectedPiece
          ? Math.max(Math.abs(row - selectedPiece.row), Math.abs(col - selectedPiece.col))
          : 0
        return (
          <ValidMoveMarker
            key={`${row}-${col}`}
            x={x} z={z} row={row} col={col}
            appearDelay={dist * 0.028}
            caution={isValidMove(row, col, cautionMoves)}
            onHover={() => setHoveredTile({ x, z })}
            onUnhover={() => setHoveredTile(null)}
            tileHovered={hoveredTile?.x === x && hoveredTile?.z === z}
            dimmed={hoveredTile !== null && !(hoveredTile.x === x && hoveredTile.z === z)}
          />
        )
      })}

      <LastMovePathGlow path={lastMovePath} boardOffset={boardOffset} />

      {!powerSaving && (
        <TileHoverGlow
          x={hoveredTile?.x ?? 0}
          z={hoveredTile?.z ?? 0}
          active={hoveredTile !== null}
        />
      )}

      {/* Departing orbs — animate out in reverse order */}
      {!menuPhase?.match(/hiding|hidden/) && leavingMarkers.map(m => (
        <ValidMoveMarker
          key={`leaving-${m.row}-${m.col}`}
          x={m.x} z={m.z} row={m.row} col={m.col}
          appearDelay={0}
          disappearing
          disappearDelay={m.disappearDelay}
        />
      ))}
    </group>
  )
}
