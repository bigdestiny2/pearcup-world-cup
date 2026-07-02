# PearCup — Anime Design Directions

Three previewable directions for a modern, anime-styled PearCup with little anime-character
avatars, 3D tactile buttons, and motion. Each mockup renders the **Profile + Live Hub** screen
because it exercises the most surface: avatar, primary CTA, nav, live-match card, and pool cards.

Open `design/index.html` for the side-by-side gallery, or each file directly.

---

## 1 · Shonen Blitz — `spec-1-shonen-blitz.html`
**Mood:** bold sports-anime energy (Blue Lock / Captain Tsubasa). High-stakes, loud, competitive.

- **Palette:** ink `#0a0713`, hot pink `#ff2e63`, volt yellow `#ffd23f`, cyan `#12e6d0`, violet `#8a5cff`.
- **Type:** `Bakbak One` display (chunky), `Sora` body.
- **3D buttons:** hard bottom-extrude (`box-shadow: 0 7px 0 …`) that presses down 6px on `:active`. Reads like an arcade cabinet button.
- **Motion:** drifting speed-lines background, conic energy-burst behind the avatar, bobbing character, twinkling sparkles, animated stat-bar fills, pulsing LIVE dot.
- **Avatar:** spiky-hair chibi striker, big violet eyes with highlights, team-colored jersey + number.
- **Best if:** you want PearCup to feel like a hype competitive tournament.

## 2 · Kawaii Cup — `spec-2-kawaii-cup.html`
**Mood:** soft, cute, friendly. Broad appeal, casual watch-party vibe.

- **Palette:** blush bg `#fff4fb`, pink `#ff8fc0`, mint `#6fe0c8`, sky `#7cc4ff`, lemon `#ffd76b`, grape `#b79bff`.
- **Type:** `Baloo 2` (rounded display), `Nunito` body.
- **3D buttons:** squishy candy buttons with a bouncy overshoot easing (`cubic-bezier(.34,1.56,.64,1)`) and colored bottom-extrude.
- **Motion:** floating bubble field, hopping avatar, twinkling hearts/flowers, soft glow puff.
- **Avatar:** extra-big-head chibi with pink pigtail puffs, huge sparkly eyes, rosy blush — the most "character-forward" of the three.
- **Best if:** you want mass-market warmth and shareability.

## 3 · Neo-Tokyo Pitch — `spec-3-neo-tokyo.html`
**Mood:** dark cyberpunk anime HUD. Premium, techy — leans into the P2P / QVAC / crypto-rails story.

- **Palette:** near-black `#04060e`, neon cyan `#28f0ff`, magenta `#ff2fb0`, lime `#b6ff3c`, amber, blue.
- **Type:** `Orbitron` display, `Rajdhani` body — all-caps, wide tracking.
- **3D buttons:** glassmorphic neon slabs with glow + extrude, inset light, glowing text.
- **Motion:** perspective neon grid floor, rotating scan ring + sweeping scanline behind avatar, glitch glyphs, glowing stat bars.
- **Avatar:** cyber-striker chibi with glowing dual-color eyes, cheek tech-marks, cyan spiky hair, hashed-kit label — ties into the "kit hashed → 0x7a…" P2P identity angle.
- **Best if:** you want to lean into the decentralized/Pear tech identity and look premium.

---

## Shared system (applies to whichever we pick)
- **Avatars:** SVG chibi characters, procedurally themeable by team colors (jersey gradient, hair, kit swatches) — same generative approach as the current `avatarSvg()`, restyled. Can later be upgraded to AI-generated anime portraits per user.
- **3D button spec:** every primary action uses a solid-color face + bottom "extrude" shadow + a downward translate on `:active` for tactile press feedback.
- **Layout:** 2-column hub — hero/avatar rail (spans full height) + stacked live-match and pools cards. Scales to the existing 5 screens (Profile, Home, Bracket, Watch, Games).

## Next steps once a direction is chosen
1. Lock design tokens (CSS custom properties) into `app/styles.css`.
2. Rebuild `avatarSvg()` with the chosen chibi character art.
3. Roll the 3D button + card system across all five screens.
4. (Optional) Generate real anime avatar art via the image model for hero moments.
