'use strict'

const bouts = [
  { id: 'main', red: { name: 'R. Silva', record: '34-11-0', corner: 'RED' }, blue: { name: 'D. Jones', record: '27-1-0', corner: 'BLUE' }, weight: 'Light Heavyweight', rounds: 5, status: 'Main event' },
  { id: 'co-main', red: { name: 'A. Nunes', record: '23-5-0', corner: 'RED' }, blue: { name: 'V. Shevchenko', record: '23-4-0', corner: 'BLUE' }, weight: 'Women\'s Bantamweight', rounds: 5, status: 'Co-main' },
  { id: '3', red: { name: 'M. Oliveira', record: '34-9-0', corner: 'RED' }, blue: { name: 'B. Dariush', record: '22-5-1', corner: 'BLUE' }, weight: 'Lightweight', rounds: 3, status: 'Featured' },
  { id: '4', red: { name: 'C. Sterling', record: '23-4-0', corner: 'RED' }, blue: { name: 'S. O\'Malley', record: '17-1-0', corner: 'BLUE' }, weight: 'Bantamweight', rounds: 5, status: 'Title' }
]

const miniGames = [
  { id: 'round-winner', title: 'Round Winner', icon: '../generated-assets/mma-card/mini-game-icon-set/round-winner.png' },
  { id: 'knockdown', title: 'Knockdown', icon: '../generated-assets/mma-card/mini-game-icon-set/knockdown.png' },
  { id: 'takedown', title: 'Takedown', icon: '../generated-assets/mma-card/mini-game-icon-set/takedown.png' },
  { id: 'submission', title: 'Submission', icon: '../generated-assets/mma-card/mini-game-icon-set/submission.png' },
  { id: 'stoppage', title: 'Stoppage', icon: '../generated-assets/mma-card/mini-game-icon-set/stoppage.png' },
  { id: 'decision', title: 'Decision', icon: '../generated-assets/mma-card/mini-game-icon-set/decision.png' },
  { id: 'trivia', title: 'Trivia', icon: '../generated-assets/mma-card/mini-game-icon-set/trivia.png' },
  { id: 'reaction', title: 'Reaction', icon: '../generated-assets/mma-card/mini-game-icon-set/reaction.png' }
]

const $ = (selector, root = document) => root.querySelector(selector)

boot()

function boot () {
  $('#backToLobby').addEventListener('click', () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'close-app' }, '*')
    } else {
      window.location.href = '../lobby-app/index.html'
    }
  })

  renderHero()
  renderBouts()
  renderMiniGames()
}

function renderHero () {
  const main = bouts[0]
  $('#mainEventTitle').textContent = `${main.red.name} vs ${main.blue.name}`
  $('#mainEventSubtitle').textContent = `${main.weight} • ${main.rounds} rounds`
  $('#heroMedia').innerHTML = `
    <img src="../generated-assets/mma-card/hero-backdrop/wide.png" alt="Fight card hero">
  `
}

function renderBouts () {
  $('#boutCount').textContent = `${bouts.length} bouts`
  $('#boutList').innerHTML = bouts.map(bout => `
    <article class="bout-card">
      <div class="fighter red">
        <div class="fighter-corner">${escapeHtml(bout.red.corner)}</div>
        <div class="fighter-name">${escapeHtml(bout.red.name)}</div>
        <div class="fighter-record">${escapeHtml(bout.red.record)}</div>
      </div>
      <span class="vs">VS</span>
      <div class="fighter blue">
        <div class="fighter-corner">${escapeHtml(bout.blue.corner)}</div>
        <div class="fighter-name">${escapeHtml(bout.blue.name)}</div>
        <div class="fighter-record">${escapeHtml(bout.blue.record)}</div>
      </div>
      <div class="bout-meta">
        <span class="pill">${escapeHtml(bout.status)}</span>
        <span>${escapeHtml(bout.weight)}</span>
        <span>${bout.rounds} rounds</span>
      </div>
    </article>
  `).join('')
}

function renderMiniGames () {
  $('#miniGameGrid').innerHTML = miniGames.map(game => `
    <button class="mini-game-card" type="button" data-game="${escapeAttr(game.id)}">
      <img src="${escapeAttr(game.icon)}" alt="" loading="lazy">
      <strong>${escapeHtml(game.title)}</strong>
      <span>Challenge or room</span>
    </button>
  `).join('')
}

function escapeHtml (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr (value) {
  return escapeHtml(value).replace(/`/g, '&#96;')
}
