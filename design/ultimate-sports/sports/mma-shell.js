'use strict'

const MMA_FIXTURES = [
  { boutId: 'main', fighterA: 'Red Corner', fighterB: 'Blue Corner', weightClass: 'Lightweight', mainEvent: true, status: 'live', round: 3, time: "2:34" },
  { boutId: 'co-main', fighterA: 'Silver Strike', fighterB: 'Iron Chin', weightClass: 'Welterweight', mainEvent: false, status: 'scheduled', round: null, time: 'Next' },
  { boutId: 'prelim-1', fighterA: 'Quick Hands', fighterB: 'Heavy Foot', weightClass: 'Middleweight', mainEvent: false, status: 'scheduled', round: null, time: 'Later' },
  { boutId: 'prelim-2', fighterA: 'Ground Game', fighterB: 'Stand Up', weightClass: 'Featherweight', mainEvent: false, status: 'finished', round: 2, time: 'R2 KO' }
]

const MMA_PLAYERS = [
  { username: 'FightFan1', status: 'online', activity: 'watching main event' },
  { username: 'KnockoutKing', status: 'online', activity: 'in pick lobby' },
  { username: 'GroundPound', status: 'away', activity: 'idle' },
  { username: 'CardShark', status: 'online', activity: 'betting method props' },
  { username: 'TriviaMaster', status: 'online', activity: 'between-fight trivia' }
]

function renderMmaShell (container, sport) {
  container.innerHTML = `
    <div class="mma-hero" style="background: linear-gradient(135deg, #18181b, #dc2626, #2563eb);">
      <div class="mma-hero-copy">
        <p class="eyebrow">${escapeHtml(sport.serverLabel)}</p>
        <h2>${escapeHtml(sport.title)}</h2>
        <p class="detail-copy">${escapeHtml(sport.description)}</p>
      </div>
      <img class="mma-hero-asset" src="./assets/mma-card/hero-backdrop/wide.png" alt="Fight night hero backdrop">
    </div>
    <div class="mma-layout">
      <section class="mma-panel">
        <h3>Fight card</h3>
        <div class="bout-list">
          ${MMA_FIXTURES.map(bout => `
            <article class="bout-card ${bout.status}">
              <div class="bout-status">
                <span class="pill is-${bout.status === 'live' ? 'good' : bout.status === 'finished' ? 'warn' : ''}">${escapeHtml(bout.status)}</span>
                <span>${escapeHtml(bout.time)}</span>
              </div>
              <div class="bout-fighters">
                <strong>${escapeHtml(bout.fighterA)}</strong>
                <span>vs</span>
                <strong>${escapeHtml(bout.fighterB)}</strong>
              </div>
              <div class="bout-meta">
                <span>${escapeHtml(bout.weightClass)}</span>
                ${bout.mainEvent ? '<span class="pill">Main event</span>' : ''}
              </div>
            </article>
          `).join('')}
        </div>
      </section>
      <section class="mma-panel">
        <h3>Live room</h3>
        <div class="mma-room">
          <img src="./assets/mma-card/watch-room-stage/live-stage.png" alt="Watch room stage">
          <div class="mma-room-bar">
            <span class="pill is-good">${MMA_PLAYERS.filter(p => p.status === 'online').length} watching</span>
            <button type="button" class="mini-button">Join voice</button>
          </div>
        </div>
      </section>
      <section class="mma-panel">
        <h3>Players</h3>
        <div class="mma-player-list">
          ${MMA_PLAYERS.map(player => `
            <div class="mma-player ${escapeHtml(player.status)}">
              <span class="player-dot"></span>
              <strong>${escapeHtml(player.username)}</strong>
              <span>${escapeHtml(player.activity)}</span>
            </div>
          `).join('')}
        </div>
      </section>
      <section class="mma-panel">
        <h3>Quick picks</h3>
        <div class="mma-picks">
          <button type="button" class="pick-button">Red corner</button>
          <button type="button" class="pick-button">Blue corner</button>
          <button type="button" class="pick-button">Method prop</button>
          <button type="button" class="pick-button">Round prop</button>
        </div>
      </section>
    </div>
  `
}

function escapeHtml (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
