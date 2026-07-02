// Generate a DIVERSE pool of kawaii chibi player avatars via the Higgsfield REST API.
// Credentials come from env (never hard-coded):
//   HF_KEY=... HF_SECRET=... node gen-avatars.mjs [name1 name2 ...]
import { writeFile, mkdir } from 'node:fs/promises'

const KEY = process.env.HF_KEY, SECRET = process.env.HF_SECRET
if (!KEY || !SECRET) { console.error('Set HF_KEY and HF_SECRET'); process.exit(1) }
const AUTH = `Key ${KEY}:${SECRET}`
const HOST = 'https://platform.higgsfield.ai'

const STYLE = 'kawaii chibi sticker portrait, head and shoulders, big sparkly eyes, rosy cheeks, thick clean white outline, flat cel shading, soft pastel colors, centered, plain flat white background, adorable, no text'

// A deliberately diverse roster — varied skin tones, hair, and kit colours so no two
// characters look alike. Names are generic pool ids the app assigns deterministically.
const ROSTER = [
  { name: 'p-aria',   seed: 5001, look: 'a cheerful girl with fair skin and long golden-blonde ponytail, wearing a red soccer jersey' },
  { name: 'p-rico',   seed: 5002, look: 'a boy with warm tan skin and spiky black hair, wearing a bright yellow soccer jersey' },
  { name: 'p-kenji',  seed: 5003, look: 'a boy with light skin and neat black bowl-cut hair, wearing a royal blue soccer jersey' },
  { name: 'p-amara',  seed: 5004, look: 'a girl with deep brown skin and curly black afro puffs, wearing a green soccer jersey' },
  { name: 'p-luca',   seed: 5005, look: 'a boy with olive skin and wavy brown hair, wearing a white soccer jersey' },
  { name: 'p-sofia',  seed: 5006, look: 'a girl with light-tan skin and brown box braids, wearing a purple soccer jersey' },
  { name: 'p-omar',   seed: 5007, look: 'a boy with brown skin, short black hair and a white headband, wearing a red and white soccer jersey' },
  { name: 'p-nina',   seed: 5008, look: 'a girl with fair skin and a short pink bob haircut, wearing a teal soccer jersey' },
  { name: 'p-diego',  seed: 5009, look: 'a boy with tan skin and slicked-back black hair, wearing a sky-blue and white striped soccer jersey' },
  { name: 'p-yuki',   seed: 5010, look: 'a soft-featured person with pale skin and short silver hair, wearing a pink soccer jersey' },
  { name: 'p-kwame',  seed: 5011, look: 'a boy with deep brown skin and a black high-top fade haircut, wearing an orange soccer jersey' },
  { name: 'p-ingrid', seed: 5012, look: 'a girl with fair skin and blonde crown braids, wearing a blue and white soccer jersey' },
  { name: 'p-rafa',   seed: 5013, look: 'a boy with tan skin and a curly brown mohawk, wearing a green and yellow soccer jersey' },
  { name: 'p-mei',    seed: 5014, look: 'a girl with light skin and black twin hair buns, wearing a crimson soccer jersey' },
  { name: 'p-tariq',  seed: 5015, look: 'a young man with brown skin, a buzz cut and a short beard, wearing a maroon soccer jersey' },
  { name: 'p-freya',  seed: 5016, look: 'a girl with fair freckled skin and wavy red hair, wearing a navy soccer jersey' },
  { name: 'p-santi',  seed: 5017, look: 'a young man with olive skin and a brown man-bun, wearing a light blue soccer jersey' },
  { name: 'p-kofi',   seed: 5018, look: 'a boy with deep brown skin and short black dreadlocks, wearing a black and gold soccer jersey' }
]

const only = process.argv.slice(2)
const list = only.length ? ROSTER.filter(a => only.includes(a.name)) : ROSTER
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function generate (a) {
  const prompt = `${a.look}, ${STYLE}`
  const res = await fetch(`${HOST}/flux-pro/kontext/max/text-to-image`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio: '1:1', safety_tolerance: 2, seed: a.seed })
  })
  const sub = await res.json()
  if (!sub.request_id) { console.log(`  ${a.name}: submit failed ${JSON.stringify(sub).slice(0, 140)}`); return }
  for (let t = 0; t < 40; t++) {
    const s = await (await fetch(`${HOST}/requests/${sub.request_id}/status`, { headers: { Authorization: AUTH } })).json()
    if (s.status === 'completed') {
      const buf = Buffer.from(await (await fetch(s.images[0].url)).arrayBuffer())
      await mkdir(new URL('./avatars/', import.meta.url), { recursive: true })
      await writeFile(new URL(`./avatars/${a.name}.png`, import.meta.url), buf)
      console.log(`  ${a.name}: done (${(buf.length / 1024 | 0)} KB)`)
      return
    }
    if (s.status === 'failed' || s.status === 'nsfw') { console.log(`  ${a.name}: ${s.status}`); return }
    await sleep(4000)
  }
  console.log(`  ${a.name}: timeout`)
}

console.log(`generating ${list.length} avatars…`)
// Batches of 6 to stay friendly with rate limits.
for (let i = 0; i < list.length; i += 6) {
  await Promise.all(list.slice(i, i + 6).map(generate))
}
console.log('all done.')
