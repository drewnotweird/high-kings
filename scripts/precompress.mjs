// Precompresses dist/ text assets to .gz and .br so nginx can serve them
// statically (gzip_static on; brotli_static on;) instead of compressing per
// request. Brotli at max quality beats nginx's default gzip by ~15-20%.
// Usage: node scripts/precompress.mjs  (runs automatically after `npm run build`)
import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { gzipSync, brotliCompressSync, constants } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const EXTS = new Set(['.js', '.css', '.html', '.svg', '.json', '.xml', '.txt', '.woff'])

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(full))
    else if (EXTS.has(path.extname(e.name))) out.push(full)
  }
  return out
}

let saved = 0
for (const file of await walk(DIST)) {
  const buf = await readFile(file)
  if (buf.length < 1024) continue
  const gz = gzipSync(buf, { level: 9 })
  const br = brotliCompressSync(buf, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  })
  await writeFile(file + '.gz', gz)
  await writeFile(file + '.br', br)
  saved += buf.length - br.length
  console.log(`${path.relative(DIST, file)}: ${(buf.length / 1024).toFixed(0)}KB -> gz ${(gz.length / 1024).toFixed(0)}KB, br ${(br.length / 1024).toFixed(0)}KB`)
}
console.log(`Total saved vs raw (brotli): ${(saved / 1024).toFixed(0)}KB`)
