/**
 * Generates base texture PNGs for each piece type.
 * Run with: npm run gen-textures
 *
 * Output files (edit these in any image editor):
 *   public/textures/piece-light.png  — defenders (ivory/bone)
 *   public/textures/piece-dark.png   — attackers (dark wood)
 *   public/textures/piece-king.png   — king (warm gold/bone)
 *
 * UV layout (how the image wraps onto the piece):
 *   ← U: 0 ──────────── 1 →   (wraps around the circumference; left/right edges join)
 *   ↑ V: 1                     (top of piece)
 *   │
 *   ↓ V: 0                     (bottom of piece)
 *
 *   The FRONT of the piece is at U = 0.5 (horizontal centre of the image).
 *   Paint shields, runes, faces etc. centred horizontally.
 *   The body of the piece occupies roughly V = 0.15 → 0.85.
 */

import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../public/textures')

const W = 512
const H = 1024

// ─── Seeded RNG ────────────────────────────────────────────────────────────────
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 4294967296
  }
}

// ─── Wood/bone grain base ─────────────────────────────────────────────────────
function drawBase(ctx, opts, seed) {
  const rand = rng(seed)

  // Base fill
  ctx.fillStyle = opts.base
  ctx.fillRect(0, 0, W, H)

  // Subtle noise
  const imgData = ctx.getImageData(0, 0, W, H)
  const d = imgData.data
  const [br, bg, bb] = hexToRgb(opts.base)
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * opts.noiseAmt
    d[i]     = clamp(br + n)
    d[i + 1] = clamp(bg + n)
    d[i + 2] = clamp(bb + n)
    d[i + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)

  // Grain lines
  for (let i = 0; i < opts.grainCount; i++) {
    const x = rand() * W
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= H; y += 8) {
      ctx.lineTo(x + Math.sin(y * 0.03 + rand() * Math.PI) * opts.waver + (rand() - 0.5) * 2, y)
    }
    ctx.strokeStyle = opts.grain
    ctx.lineWidth = rand() * 1.4 + 0.4
    ctx.globalAlpha = opts.grainOpacity * (0.4 + rand() * 0.6)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ─── UV guide overlay (shown faintly — helps you know where to paint) ─────────
function drawGuide(ctx) {
  ctx.save()
  ctx.globalAlpha = 0.18

  // Vertical centre line (front of piece)
  ctx.setLineDash([8, 6])
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W / 2, 0)
  ctx.lineTo(W / 2, H)
  ctx.stroke()

  // Body region markers (approx V=0.15 to V=0.85)
  const top = H - H * 0.85
  const bot = H - H * 0.15
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = '#ffff00'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, bot); ctx.lineTo(W, bot); ctx.stroke()

  // Label
  ctx.globalAlpha = 0.35
  ctx.fillStyle = '#ffffff'
  ctx.font = '13px monospace'
  ctx.fillText('← FRONT (paint details here) →', W / 2 - 120, top - 8)
  ctx.fillText('body region', 6, top + 18)

  ctx.restore()
}

// ─── Piece definitions ─────────────────────────────────────────────────────────
const pieces = [
  {
    name: 'piece-light',   // defenders
    seed: 42,
    base: '#c8aa80',
    grain: '#6b3e18',
    grainCount: 60,
    grainOpacity: 0.22,
    waver: 5,
    noiseAmt: 18,
  },
  {
    name: 'piece-dark',    // attackers
    seed: 137,
    base: '#1c0d05',
    grain: '#4a2008',
    grainCount: 50,
    grainOpacity: 0.30,
    waver: 4,
    noiseAmt: 12,
  },
  {
    name: 'piece-king',    // king
    seed: 999,
    base: '#c08030',
    grain: '#5a2e08',
    grainCount: 55,
    grainOpacity: 0.20,
    waver: 5,
    noiseAmt: 14,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}
function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))) }

// ─── Roughness map ────────────────────────────────────────────────────────────
// Greyscale image — dark = shiny/highlighted, light = matte/rough.
// Paint dark where you want specular shine (e.g. raised carved edges, top of dome).
function drawRoughness(ctx, baseValue = 180) {
  // Mid-grey base — partially rough
  ctx.fillStyle = `rgb(${baseValue},${baseValue},${baseValue})`
  ctx.fillRect(0, 0, W, H)

  // Dome top is naturally smoother (darker = shinier)
  const grad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.7)
  grad.addColorStop(0, `rgba(60,60,60,0.5)`)
  grad.addColorStop(1, `rgba(0,0,0,0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  drawGuide(ctx)
}

// ─── Compressed write helper ──────────────────────────────────────────────────
async function writePng(canvas, outPath, { width, height } = {}) {
  let pipeline = sharp(canvas.toBuffer('image/png'))
  if (width && height) pipeline = pipeline.resize(width, height)
  const buf = await pipeline.png({ compressionLevel: 9, effort: 10 }).toBuffer()
  writeFileSync(outPath, buf)
  console.log(`✓ ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`)
}

// ─── Generate ─────────────────────────────────────────────────────────────────
for (const p of pieces) {
  // Colour / diffuse map
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  drawBase(ctx, p, p.seed)
  drawGuide(ctx)
  await writePng(canvas, path.join(OUT, `${p.name}.png`))

  // Roughness map
  const rCanvas = createCanvas(W, H)
  const rCtx = rCanvas.getContext('2d')
  drawRoughness(rCtx)
  await writePng(rCanvas, path.join(OUT, `${p.name}-roughness.png`))
}

console.log('\nDone. Edit piece PNGs in any image editor, then reload the browser.')
console.log('Roughness maps: dark = shiny, light = matte.')

// ─── Tile base textures (10 variants) ─────────────────────────────────────────
// All tiles use the same pale stone look but with different grain seeds.
// Edit tile-1.png through tile-10.png in any image editor.
const TW = 512
const TH = 512

function drawTile(ctx, seed) {
  const rand = rng(seed)
  const base = '#c8bfa8'
  const grain = '#7a6a50'

  ctx.fillStyle = base
  ctx.fillRect(0, 0, TW, TH)

  // Subtle noise
  const imgData = ctx.getImageData(0, 0, TW, TH)
  const d = imgData.data
  const [br, bg, bb] = hexToRgb(base)
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 22
    d[i]     = clamp(br + n)
    d[i + 1] = clamp(bg + n)
    d[i + 2] = clamp(bb + n)
    d[i + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)

  // Fine grain lines in varying directions
  const angle = rand() * Math.PI
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const lineCount = 30 + Math.floor(rand() * 20)
  for (let i = 0; i < lineCount; i++) {
    const t = rand() * TW * 2 - TW * 0.5
    ctx.beginPath()
    ctx.moveTo(t * cos - (-TH) * sin, t * sin + (-TH) * cos)
    ctx.lineTo(t * cos - TH * 2 * sin, t * sin + TH * 2 * cos)
    ctx.strokeStyle = grain
    ctx.lineWidth = rand() * 1.2 + 0.3
    ctx.globalAlpha = 0.08 + rand() * 0.14
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ─── Overlay marker textures (transparent PNGs) ───────────────────────────────
// These sit on top of specific tiles. Edit them to add runes, symbols, etc.
// Background is fully transparent — only the marker is painted.

function drawCornerOverlay(ctx) {
  ctx.clearRect(0, 0, TW, TH)
  const cx = TW / 2, cy = TH / 2, r = TW * 0.35
  // Octagon ring
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 8
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  ctx.closePath()
  ctx.strokeStyle = '#8b0000'
  ctx.lineWidth = 10
  ctx.globalAlpha = 0.7
  ctx.stroke()
  // Inner dot
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = '#8b0000'
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawThroneOverlay(ctx) {
  ctx.clearRect(0, 0, TW, TH)
  const cx = TW / 2, cy = TH / 2
  ctx.globalAlpha = 0.65
  // Cross of lines
  for (let rot = 0; rot < 4; rot++) {
    const a = (rot / 4) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * TW * 0.38, cy + Math.sin(a) * TH * 0.38)
    ctx.strokeStyle = '#c8a830'
    ctx.lineWidth = 8
    ctx.stroke()
  }
  // Centre circle
  ctx.beginPath()
  ctx.arc(cx, cy, TW * 0.12, 0, Math.PI * 2)
  ctx.strokeStyle = '#c8a830'
  ctx.lineWidth = 8
  ctx.stroke()
  // Outer ring
  ctx.beginPath()
  ctx.arc(cx, cy, TW * 0.38, 0, Math.PI * 2)
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawDefenderOverlay(ctx) {
  ctx.clearRect(0, 0, TW, TH)
  const cx = TW / 2, cy = TH / 2, r = TW * 0.28
  ctx.globalAlpha = 0.5
  // Simple circle marker
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = '#c8a45a'
  ctx.lineWidth = 7
  ctx.stroke()
  // Small inner dot
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2)
  ctx.fillStyle = '#c8a45a'
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawAttackerOverlay(ctx) {
  ctx.clearRect(0, 0, TW, TH)
  const cx = TW / 2, cy = TH / 2, r = TW * 0.28
  ctx.globalAlpha = 0.5
  // Diamond
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r, cy)
  ctx.closePath()
  ctx.strokeStyle = '#8b2000'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.globalAlpha = 1
}

// Generate tile base variants (resized to 256×256 — sufficient at tile scale)
for (let i = 1; i <= 10; i++) {
  const canvas = createCanvas(TW, TH)
  const ctx = canvas.getContext('2d')
  drawTile(ctx, i * 137)
  await writePng(canvas, path.join(OUT, `tile-${i}.png`), { width: 256, height: 256 })
}

// Generate overlay markers (resized to 256×256)
const overlays = [
  { name: 'tile-corner',   fn: drawCornerOverlay },
  { name: 'tile-throne',   fn: drawThroneOverlay },
  { name: 'tile-defender', fn: drawDefenderOverlay },
  { name: 'tile-attacker', fn: drawAttackerOverlay },
]
for (const { name, fn } of overlays) {
  const canvas = createCanvas(TW, TH)
  const ctx = canvas.getContext('2d')
  fn(ctx)
  await writePng(canvas, path.join(OUT, `${name}.png`), { width: 256, height: 256 })
}

console.log('\nAll tile textures generated.')
console.log('Edit tile-1.png … tile-10.png for base tile variety.')
console.log('Edit tile-corner/throne/defender/attacker.png for markers.')
