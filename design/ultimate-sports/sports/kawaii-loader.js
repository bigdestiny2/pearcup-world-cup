'use strict'

function loadKawaiiSport (container, sport, opts = {}) {
  const inPear = typeof Pear !== 'undefined' && Pear.config && Pear.config.applink

  if (inPear && sport.pearLink) {
    container.innerHTML = `
      <div class="loader-panel">
        <p class="eyebrow">Pear launch</p>
        <h2>Opening ${escapeHtml(sport.title)}</h2>
        <p class="detail-copy">Launching the PearCup Kawaii app from the lobby.</p>
        <button type="button" class="splash-button" id="openKawaiiPear">Open ${escapeHtml(sport.title)}</button>
        <button type="button" class="back-button" data-back-to-lobby>Back to lobby</button>
      </div>
    `
    const openBtn = container.querySelector('#openKawaiiPear')
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (typeof Pear !== 'undefined' && Pear.runtime && typeof Pear.runtime.open === 'function') {
          Pear.runtime.open(sport.pearLink)
        } else {
          window.location.href = sport.pearLink
        }
      })
    }
    bindBackToLobby(container)
    return
  }

  container.innerHTML = `
    <div class="loader-panel">
      <p class="eyebrow">Local preview</p>
      <h2>${escapeHtml(sport.title)}</h2>
      <p class="detail-copy">In a live Pear build this would open the Kawaii app. In local preview it opens in a new tab.</p>
      <a class="splash-button" href="${escapeAttr(sport.kawaiiPath)}" target="_blank" rel="noopener">Open Kawaii preview</a>
      <button type="button" class="back-button" data-back-to-lobby>Back to lobby</button>
    </div>
  `
  bindBackToLobby(container)
}

function renderPlaceholderSport (container, sport) {
  container.innerHTML = `
    <div class="loader-panel">
      <p class="eyebrow">Coming soon</p>
      <h2>${escapeHtml(sport.title)}</h2>
      <p class="detail-copy">This sport server is not live yet. Check back when the event starts.</p>
      <div class="placeholder-stats">
        <div><strong>${escapeHtml(sport.playerCount)}</strong><span>players waiting</span></div>
        <div><strong>${escapeHtml(sport.roomCount)}</strong><span>rooms reserved</span></div>
      </div>
      <button type="button" class="back-button" data-back-to-lobby>Back to lobby</button>
    </div>
  `
  bindBackToLobby(container)
}

function bindBackToLobby (container) {
  const back = container.querySelector('[data-back-to-lobby]')
  if (back) {
    back.addEventListener('click', () => {
      if (typeof window.showLobby === 'function') window.showLobby()
    })
  }
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
