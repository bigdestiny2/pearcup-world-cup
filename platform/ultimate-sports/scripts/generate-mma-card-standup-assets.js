#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const {
  createMmaCardAssetPlan,
  createMmaCardGeneratedAssetAudit
} = require('../src/mma-card-asset-engine')

const DEFAULT_OUTPUT_ROOT = 'platform/ultimate-sports/generated-assets/mma-card'
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function generateMmaCardStandupAssets (input = {}) {
  const rootDir = input.rootDir || path.resolve(__dirname, '..', '..', '..')
  const outputRoot = input.outputRoot || DEFAULT_OUTPUT_ROOT
  const generatedAt = input.generatedAt || new Date().toISOString()
  const force = Boolean(input.force)
  const plan = createMmaCardAssetPlan({
    tournamentId: input.tournamentId || 'mma-card',
    title: input.title || 'MMA Fight Card',
    provider: input.provider || 'standup-fixture',
    outputRoot
  })
  const targets = plan.assets.flatMap(asset => [
    ...asset.outputTargets.map(target => ({ asset, target, kind: 'image' })),
    ...asset.motionOutputTargets.map(target => ({ asset, target, kind: 'video-loop' }))
  ])
  const written = []
  const skipped = []

  targets.forEach((item, index) => {
    const absolutePath = resolveTargetPath({ rootDir, targetPath: item.target.path })
    if (!force && fs.existsSync(absolutePath)) {
      skipped.push(item.target.path)
      return
    }

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    const buffer = item.kind === 'video-loop'
      ? createStandupMp4Fixture({ item, index, generatedAt })
      : createStandupPngFixture({ item, index })
    fs.writeFileSync(absolutePath, buffer)
    written.push(item.target.path)
  })

  const metadataPath = path.resolve(rootDir, outputRoot, '_standup-fixture-metadata.json')
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true })
  fs.writeFileSync(metadataPath, `${JSON.stringify({
    fixtureVersion: 'ultimate-sports-mma-card-standup-assets-v1',
    generatedAt,
    outputRoot,
    force,
    targetCount: targets.length,
    writtenCount: written.length,
    skippedCount: skipped.length,
    source: 'local deterministic standup fixture generator',
    productionReplacement: 'Replace with Higgsfield-generated finals and rerun audit-mma-card-assets before production prize-mode promotion.',
    rightsPolicy: plan.style.rightsPolicy,
    written,
    skipped
  }, null, 2)}\n`)

  const audit = createMmaCardGeneratedAssetAudit({
    rootDir,
    tournamentId: input.tournamentId || 'mma-card',
    title: input.title || 'MMA Fight Card',
    provider: input.provider || 'standup-fixture',
    outputRoot,
    generatedAt
  })

  return {
    generatedAt,
    outputRoot,
    metadataPath,
    targetCount: targets.length,
    writtenCount: written.length,
    skippedCount: skipped.length,
    audit
  }
}

function createStandupPngFixture ({ item, index }) {
  const dimensions = dimensionsForTarget(item)
  const palette = paletteForIndex(index)
  const width = dimensions.width
  const height = dimensions.height
  const raw = Buffer.alloc((width * 4 + 1) * height)

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1)
    raw[rowOffset] = 0
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4
      const diagonal = (x + y + index * 17) % 91 < 18
      const centerBand = Math.abs((x / width) - 0.5) < 0.11 || Math.abs((y / height) - 0.5) < 0.08
      const t = (x / Math.max(1, width - 1) + y / Math.max(1, height - 1)) / 2
      const base = mixColor(palette.dark, palette.wash, t * 0.42)
      const accent = diagonal ? palette.red : centerBand ? palette.gold : palette.blue
      const mixed = mixColor(base, accent, diagonal ? 0.28 : centerBand ? 0.18 : 0.08)
      raw[offset] = mixed[0]
      raw[offset + 1] = mixed[1]
      raw[offset + 2] = mixed[2]
      raw[offset + 3] = 255
    }
  }

  return createPng({ width, height, raw })
}

function createStandupMp4Fixture ({ item, index, generatedAt }) {
  const descriptor = JSON.stringify({
    fixture: 'standup-motion-loop-placeholder',
    assetType: item.asset.assetType,
    variant: item.target.variant,
    generatedAt,
    index,
    note: 'Replace with a real Higgsfield MP4 final before production launch.'
  })
  return Buffer.concat([
    box('ftyp', Buffer.concat([
      Buffer.from('isom'),
      Buffer.from([0x00, 0x00, 0x02, 0x00]),
      Buffer.from('isomiso2mp41')
    ])),
    box('free', Buffer.from(descriptor)),
    box('mdat', Buffer.from(`PearCup Ultimate Sports standup motion fixture ${index}\n`))
  ])
}

function dimensionsForTarget ({ asset, target }) {
  const variant = String(target.variant || '')
  if (asset.assetType === 'lobby-icon' || asset.assetType === 'mini-game-icon-set' || variant.includes('badge') || variant.includes('mask')) {
    return { width: 512, height: 512 }
  }
  if (variant.includes('vertical') || variant.includes('mobile')) return { width: 360, height: 640 }
  if (variant.includes('tablet') || variant.includes('4:3')) return { width: 640, height: 480 }
  if (variant.includes('horizontal')) return { width: 720, height: 240 }
  if (variant.includes('1200x630') || variant.includes('share')) return { width: 600, height: 315 }
  return { width: 640, height: 360 }
}

function paletteForIndex (index) {
  const palettes = [
    { dark: [19, 19, 21], wash: [245, 240, 232], red: [191, 51, 56], blue: [34, 111, 192], gold: [185, 137, 35] },
    { dark: [22, 29, 30], wash: [231, 239, 237], red: [173, 42, 48], blue: [42, 91, 168], gold: [211, 170, 69] },
    { dark: [28, 25, 24], wash: [242, 236, 224], red: [210, 57, 58], blue: [29, 87, 145], gold: [160, 118, 29] }
  ]
  return palettes[index % palettes.length]
}

function mixColor (a, b, amount) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount)
  ]
}

function createPng ({ width, height, raw }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function pngChunk (type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

function box (type, payload) {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(payload.length + 8, 0)
  header.write(type, 4, 4, 'ascii')
  return Buffer.concat([header, payload])
}

function crc32 (buffer) {
  let crc = 0xffffffff
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[index]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

const CRC_TABLE = (() => {
  const table = []
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function resolveTargetPath ({ rootDir, targetPath }) {
  if (path.isAbsolute(targetPath)) return targetPath
  return path.resolve(rootDir, targetPath)
}

function parseArgs (argv = process.argv.slice(2)) {
  const options = {
    force: false
  }
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--output-root') options.outputRoot = argv[++index]
    else if (item === '--generated-at') options.generatedAt = argv[++index]
    else if (item === '--title') options.title = argv[++index]
    else if (item === '--tournament-id') options.tournamentId = argv[++index]
    else if (item === '--provider') options.provider = argv[++index]
    else if (item === '--force') options.force = true
  }
  return options
}

function main (argv = process.argv.slice(2)) {
  const result = generateMmaCardStandupAssets(parseArgs(argv))
  process.stdout.write(`MMA card standup assets generated\n`)
  process.stdout.write(`Output root: ${result.outputRoot}\n`)
  process.stdout.write(`Targets: ${result.audit.summary.presentTargets}/${result.audit.summary.targetCount}\n`)
  process.stdout.write(`Written: ${result.writtenCount}; skipped existing: ${result.skippedCount}\n`)
  process.stdout.write(`Status: ${result.audit.overallStatus}\n`)
  return result
}

if (require.main === module) main()

module.exports = {
  generateMmaCardStandupAssets,
  parseArgs,
  main
}
