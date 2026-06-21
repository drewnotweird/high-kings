import { CanvasTexture, RepeatWrapping } from 'three'

// ─── Adjustable parameters ────────────────────────────────────────────────────
// Edit these values to change how the piece textures look.

export const textureParams = {
  light: {
    // Ivory/bone — used for defender pieces
    base: '#d4b896',         // base fill colour
    grain: '#7a4e28',        // grain line colour
    grainCount: 48,          // number of grain lines
    grainOpacity: 0.18,      // how visible the grain is (0–1)
    grainWaver: 4,           // how wavy the grain lines are (px)
    noiseStrength: 0.12,     // subtle surface noise (0–1)
  },
  dark: {
    // Dark carved wood — used for attacker pieces
    base: '#1e0e06',
    grain: '#5c3010',
    grainCount: 40,
    grainOpacity: 0.25,
    grainWaver: 3,
    noiseStrength: 0.10,
  },
  king: {
    // Warm golden bone — used for the king
    base: '#c8963c',
    grain: '#6b4010',
    grainCount: 44,
    grainOpacity: 0.20,
    grainWaver: 4,
    noiseStrength: 0.10,
  },
}

// ─── Texture size ─────────────────────────────────────────────────────────────
// Higher = sharper but uses more GPU memory. 256 is good, 512 is premium.
const TEX_W = 256
const TEX_H = 512

// ─── Internal helpers ─────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function buildColorTexture(params: typeof textureParams.light, seed: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')!

  // Base colour
  ctx.fillStyle = params.base
  ctx.fillRect(0, 0, TEX_W, TEX_H)

  // Subtle noise overlay
  const imageData = ctx.getImageData(0, 0, TEX_W, TEX_H)
  const { r: br, g: bg, b: bb } = hexToRgb(params.base)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * params.noiseStrength * 80
    imageData.data[i]     = Math.max(0, Math.min(255, br + n))
    imageData.data[i + 1] = Math.max(0, Math.min(255, bg + n))
    imageData.data[i + 2] = Math.max(0, Math.min(255, bb + n))
    imageData.data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)

  // Grain lines — slightly wavy vertical strokes
  const rng = mulberry32(seed)
  for (let i = 0; i < params.grainCount; i++) {
    const x = rng() * TEX_W
    const lineWidth = rng() * 1.2 + 0.3
    const alpha = params.grainOpacity * (0.5 + rng() * 0.5)

    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= TEX_H; y += 6) {
      const wx = x + Math.sin(y * 0.04 + rng() * Math.PI) * params.grainWaver + (rng() - 0.5) * 1.5
      ctx.lineTo(wx, y)
    }
    ctx.strokeStyle = params.grain
    ctx.lineWidth = lineWidth
    ctx.globalAlpha = alpha
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

function buildRoughnessTexture(_params: typeof textureParams.light, seed: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')!

  // Base roughness — lighter = rougher in Three.js roughness map
  ctx.fillStyle = '#888'
  ctx.fillRect(0, 0, TEX_W, TEX_H)

  // Carved recesses are rougher (brighter patches)
  const rng = mulberry32(seed + 999)
  const imageData = ctx.getImageData(0, 0, TEX_W, TEX_H)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = 120 + Math.floor(rng() * 80)
    imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = v
    imageData.data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)

  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

function buildBumpTexture(params: typeof textureParams.light, seed: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, TEX_W, TEX_H)

  // Bump lines matching grain direction
  const rng = mulberry32(seed + 1337)
  for (let i = 0; i < params.grainCount; i++) {
    const x = rng() * TEX_W
    const bright = 100 + Math.floor(rng() * 80)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= TEX_H; y += 6) {
      const wx = x + Math.sin(y * 0.04) * params.grainWaver
      ctx.lineTo(wx, y)
    }
    ctx.strokeStyle = `rgb(${bright},${bright},${bright})`
    ctx.lineWidth = 1 + rng() * 2
    ctx.globalAlpha = 0.3 + rng() * 0.4
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

// Seedable RNG so textures are stable across re-renders
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type PieceTextures = {
  map: CanvasTexture
  roughnessMap: CanvasTexture
  bumpMap: CanvasTexture
}

export function buildPieceTextures(type: 'light' | 'dark' | 'king'): PieceTextures {
  const seeds = { light: 42, dark: 137, king: 999 }
  const params = textureParams[type]
  const seed = seeds[type]
  return {
    map: buildColorTexture(params, seed),
    roughnessMap: buildRoughnessTexture(params, seed),
    bumpMap: buildBumpTexture(params, seed),
  }
}
