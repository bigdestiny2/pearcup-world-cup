// Batch-generate game assets via the Higgsfield REST API and download them.
// Credentials come from env (never hard-coded):
//   HF_KEY=... HF_SECRET=... node gen-assets.mjs [name1 name2 ...]
// With no args it generates all; pass names to (re)generate a subset.
import { writeFile, mkdir } from 'node:fs/promises'

const KEY = process.env.HF_KEY, SECRET = process.env.HF_SECRET
if (!KEY || !SECRET) { console.error('Set HF_KEY and HF_SECRET'); process.exit(1) }
const AUTH = `Key ${KEY}:${SECRET}`
const HOST = 'https://platform.higgsfield.ai'

const STICKER = 'kawaii chibi sticker style, thick clean white outline, flat cel shading, soft pastel colors'
const ASSETS = [
  { name: 'stadium-bg', aspect: '16:9', seed: 3101, prompt: 'kawaii illustrated football stadium interior, packed cheerful crowd in colorful stands, bright blue sky with fluffy clouds, tall floodlights, lush green grass pitch, soft pastel colors, flat vector cartoon style, wide panoramic view, cute and vibrant, no text' },
  { name: 'ball', aspect: '1:1', seed: 3102, prompt: `a single cute glossy soccer ball, classic black and white pattern with a subtle shine, ${STICKER}, centered, plain flat white background` },
  { name: 'confetti', aspect: '1:1', seed: 3103, prompt: 'colorful confetti explosion and golden sparkles and stars bursting outward, pink blue yellow green confetti, bright vibrant celebration particles, on a solid pure black background, no people, no text' },
  { name: 'trophy', aspect: '1:1', seed: 3104, prompt: `a shiny golden football trophy cup with cute sparkles and a star on top, ${STICKER}, glossy, celebratory, soft pastel pink background, centered, adorable` },
  { name: 'mascot', aspect: '3:4', seed: 3105, prompt: `an adorable kawaii mascot, a cute happy green pear character with a smiling face, big sparkly eyes, rosy cheeks, kicking a tiny soccer ball, ${STICKER}, soft pastel pink background, centered, friendly mascot logo` },
  { name: 'pool-bronze', aspect: '1:1', seed: 3106, prompt: `a cute shiny bronze medal coin with a small soccer ball emblem in the center, ${STICKER}, soft pastel background, centered, glossy game reward icon` },
  { name: 'pool-silver', aspect: '1:1', seed: 3107, prompt: `a cute shiny silver medal coin with a small soccer ball emblem in the center, ${STICKER}, soft pastel background, centered, glossy game reward icon` },
  { name: 'pool-gold', aspect: '1:1', seed: 3108, prompt: `a cute shiny gold medal coin with a small soccer ball emblem in the center, ${STICKER}, soft pastel background, centered, glossy game reward icon` },
  { name: 'pool-elite', aspect: '1:1', seed: 3109, prompt: `a cute sparkling diamond and platinum trophy badge with a small crown, ${STICKER}, soft pastel background, centered, glossy elite reward icon` },
  { name: 'couch', aspect: '16:9', seed: 3110, prompt: `a cute kawaii three-seat sofa couch, soft pastel pink plush cushions, rounded arms, front view, empty seats, ${STICKER}, plain flat white background, centered, wide` },
  { name: 'couch2', aspect: '16:9', seed: 3111, prompt: `a cute kawaii loveseat sofa, soft mint green plush cushions, rounded arms, front view, empty seats, ${STICKER}, plain flat white background, centered` }
]

const only = process.argv.slice(2)
const list = only.length ? ASSETS.filter(a => only.includes(a.name)) : ASSETS
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function generate (a) {
  const res = await fetch(`${HOST}/flux-pro/kontext/max/text-to-image`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: a.prompt, aspect_ratio: a.aspect, safety_tolerance: 2, seed: a.seed })
  })
  const sub = await res.json()
  if (!sub.request_id) { console.log(`  ${a.name}: submit failed ${JSON.stringify(sub).slice(0, 120)}`); return }
  for (let t = 0; t < 30; t++) {
    const s = await (await fetch(`${HOST}/requests/${sub.request_id}/status`, { headers: { Authorization: AUTH } })).json()
    if (s.status === 'completed') {
      const buf = Buffer.from(await (await fetch(s.images[0].url)).arrayBuffer())
      await mkdir(new URL('./assets/', import.meta.url), { recursive: true })
      await writeFile(new URL(`./assets/${a.name}.png`, import.meta.url), buf)
      console.log(`  ${a.name}: done (${(buf.length / 1024 | 0)} KB)`)
      return
    }
    if (s.status === 'failed' || s.status === 'nsfw') { console.log(`  ${a.name}: ${s.status}`); return }
    await sleep(4000)
  }
  console.log(`  ${a.name}: timeout`)
}

console.log(`generating ${list.length} assets…`)
await Promise.all(list.map(generate))
console.log('all done.')
