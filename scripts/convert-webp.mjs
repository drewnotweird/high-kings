// Converts public/ images to WebP for smaller payloads.
// Skips og-highkings.jpg (link previews want jpg/png) and icons/ (already SVG).
// Also generates a small favicon.png from the original favicon.jpg.
// Usage: node scripts/convert-webp.mjs
import sharp from 'sharp'
import { readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url))
const SKIP = new Set(['og-highkings.jpg', 'favicon.jpg'])

async function convertDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'icons') continue
      await convertDir(full)
      continue
    }
    const ext = path.extname(e.name).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) continue
    if (SKIP.has(e.name)) continue
    const out = full.replace(/\.(png|jpe?g|gif)$/i, '.webp')
    const animated = ext === '.gif'
    const before = (await stat(full)).size
    await sharp(full, { animated }).webp({ quality: 82, effort: 6 }).toFile(out)
    const after = (await stat(out)).size
    console.log(`${path.relative(PUBLIC, full)}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`)
    await unlink(full)
  }
}

await convertDir(PUBLIC)

// Small favicon (48px) — replaces the 181KB jpg being served as the tab icon
await sharp(path.join(PUBLIC, 'favicon.jpg')).resize(48, 48).png({ compressionLevel: 9 }).toFile(path.join(PUBLIC, 'favicon.png'))
// 180px apple touch icon
await sharp(path.join(PUBLIC, 'favicon.jpg')).resize(180, 180).png({ compressionLevel: 9 }).toFile(path.join(PUBLIC, 'apple-touch-icon.png'))
await unlink(path.join(PUBLIC, 'favicon.jpg'))
console.log('favicon.png + apple-touch-icon.png generated')
