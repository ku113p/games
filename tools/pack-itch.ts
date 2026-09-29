// Архив для itch.io: bun tools/pack-itch.ts <игра>   ->  dist-itch/<игра>.zip
// Внутри zip содержимое dist/<игра>/ (index.html В КОРНЕ архива, без внешней папки).
// Собирает игру заново (bun tools/build.ts), затем проверяет лимиты itch: 1000 файлов, 200 МБ на файл, 500 МБ всего.
//
// Base path: отдельной сборки для itch НЕ нужно — пути в сборке относительные ("./x.js"),
// а itch раздаёт index.html из своей папки, так что они разрешаются правильно.
// Zip пишется вручную (метод deflate), чтобы не зависеть от утилиты `zip` (её нет ни на всех машинах, ни в Bun).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const MAX_FILES = 1000
const MAX_FILE_BYTES = 200 * 1024 * 1024
const MAX_TOTAL_BYTES = 500 * 1024 * 1024

const root = resolve(import.meta.dir, '..')
const game = process.argv[2]
if (!game) {
  console.error('usage: bun tools/pack-itch.ts <game>')
  process.exit(2)
}

const build = Bun.spawnSync(['bun', 'tools/build.ts'], { cwd: root, stdout: 'inherit', stderr: 'inherit' })
if (build.exitCode !== 0) process.exit(1)

const srcDir = join(root, 'dist', game)

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const files = walk(srcDir).sort()
if (!files.some((f) => relative(srcDir, f) === 'index.html')) {
  console.error('index.html is missing at the archive root')
  process.exit(1)
}

const u16 = (n: number) => new Uint8Array([n & 255, (n >>> 8) & 255])
const u32 = (n: number) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255])
const cat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

const locals: Uint8Array[] = []
const centrals: Uint8Array[] = []
let offset = 0
let total = 0
for (const f of files) {
  const size = statSync(f).size
  if (size > MAX_FILE_BYTES) throw new Error(`${f}: ${size} bytes > 200 MB`)
  total += size
  const data = new Uint8Array(readFileSync(f))
  const name = new TextEncoder().encode(relative(srcDir, f).split('\\').join('/'))
  const packed = Bun.deflateSync(data)
  const useDeflate = packed.length < data.length
  const body = useDeflate ? packed : data
  const method = useDeflate ? 8 : 0
  const crc = Bun.hash.crc32(data)
  const common = [u16(20), u16(0x0800), u16(method), u16(0), u16(0x21), u32(crc), u32(body.length), u32(data.length), u16(name.length), u16(0)]
  const local = cat([u32(0x04034b50), ...common, name, body])
  centrals.push(cat([u32(0x02014b50), u16(20), ...common, u16(0), u16(0), u16(0), u32(0), u32(offset), name]))
  locals.push(local)
  offset += local.length
}
if (files.length > MAX_FILES) throw new Error(`${files.length} files > ${MAX_FILES}`)
if (total > MAX_TOTAL_BYTES) throw new Error(`${total} bytes > 500 MB`)

const cd = cat(centrals)
const end = cat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)])
const outDir = join(root, 'dist-itch')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, `${game}.zip`)
writeFileSync(outFile, cat([...locals, cd, end]))
console.log(`${outFile}: ${files.length} files, ${total} bytes unpacked, ${statSync(outFile).size} bytes zipped`)
