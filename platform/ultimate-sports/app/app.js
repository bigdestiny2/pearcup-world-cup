'use strict'

const state = {
  snapshot: null,
  demo: null,
  demoError: null,
  surface: 'landing',
  selectedFitId: 'mma-boxing-fight-card',
  selectedRouteFitId: 'mma-boxing-fight-card',
  selectedTournamentFitId: 'world-cup',
  selectedSurfaceId: 'home',
  selectedDesignFitId: 'world-cup',
  selectedServerFitId: 'world-cup',
  selectedServerTab: 'games'
}

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

boot()

async function boot () {
  try {
    const response = await fetch('./data/ultimate-sports-snapshot.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`snapshot fetch failed: ${response.status}`)
    state.snapshot = await response.json()
    state.selectedFitId = firstFitId(state.snapshot) || state.selectedFitId
    if (findFit(state.selectedFitId)) state.selectedRouteFitId = state.selectedFitId
    state.selectedTournamentFitId = firstTournamentFitId(state.snapshot) || state.selectedTournamentFitId
    state.selectedDesignFitId = state.selectedTournamentFitId
    state.selectedSurfaceId = firstSurfaceId(state.snapshot) || state.selectedSurfaceId
    state.selectedServerFitId = firstActiveServerFitId(state.snapshot) || state.selectedServerFitId
    bindNavigation()
    bindSelectors()
    bindServerTabs()
    bindDemoControls()
    await loadDemoState({ silent: true })
    renderAll()
    showToast('Ultimate sports snapshot loaded')
  } catch (error) {
    renderError(error)
  }
}

async function loadDemoState (input = {}) {
  try {
    state.demo = await fetchJson('./api/demo/state')
    state.demoError = null
    if (!input.silent) showToast('Live demo synced')
  } catch (error) {
    state.demoError = error
    if (!input.silent) showToast('Live demo unavailable')
  }
}

async function runDemoAction (url, body, message) {
  setDemoBusy(true)
  try {
    state.demo = await postJson(url, body)
    state.demoError = null
    renderDemo()
    showToast(message)
  } catch (error) {
    state.demoError = error
    renderDemo()
    showToast(error.message)
  } finally {
    setDemoBusy(false)
  }
}

function setDemoBusy (isBusy) {
  $$('#demo button').forEach(button => {
    button.disabled = isBusy
  })
}

async function fetchJson (url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  })
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`)
  return response.json()
}

function postJson (url, body = {}) {
  return fetchJson(url, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

function bindNavigation () {
  $$('[data-surface]').forEach(button => {
    button.addEventListener('click', () => {
      setSurface(button.dataset.surface)
    })
  })
}

function bindSelectors () {
  $('#fitSelect').addEventListener('change', event => {
    state.selectedFitId = event.target.value
    state.selectedRouteFitId = event.target.value
    renderFits()
    renderAggregator()
  })
  $('#routeSelect').addEventListener('change', event => {
    state.selectedRouteFitId = event.target.value
    renderAggregator()
  })
  $('#tournamentSelect').addEventListener('change', event => {
    state.selectedTournamentFitId = event.target.value
    renderTournaments()
  })
  $('#surfaceSelect').addEventListener('change', event => {
    state.selectedSurfaceId = event.target.value
    renderSurfaces()
  })
  $('#designFitSelect').addEventListener('change', event => {
    state.selectedDesignFitId = event.target.value
    renderDesignSystem()
  })
}

function bindServerTabs () {
  $$('[data-server-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedServerTab = button.dataset.serverTab
      $$('[data-server-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.serverTab === state.selectedServerTab))
      $$('.server-tab-panel').forEach(panel => panel.classList.toggle('is-active', panel.id === `serverTab${capitalize(state.selectedServerTab)}`))
      renderServer()
    })
  })
}

function bindDemoControls () {
  $('#demoRunDay').addEventListener('click', async () => {
    await runDemoAction('./api/demo/run-day-in-life', {}, 'Live demo day loaded')
  })
  $('#demoReset').addEventListener('click', async () => {
    await runDemoAction('./api/demo/reset', {}, 'Live demo reset')
  })
}

function setSurface (surface) {
  state.surface = surface
  $$('.surface').forEach(section => section.classList.toggle('is-active', section.id === surface))
  $$('[data-surface]').forEach(button => button.classList.toggle('is-active', button.dataset.surface === surface))
  const titles = {
    landing: 'Ultimate Sports',
    server: 'Server',
    demo: 'Live demo',
    dashboard: 'Coverage dashboard',
    fits: 'Event fit matrix',
    tournaments: 'Tournament lobby',
    surfaces: 'Surface browser',
    design: 'Design system map',
    aggregator: 'Data aggregator',
    mma: 'MMA card tournament',
    grind: 'Delivery grind'
  }
  $('#pageTitle').textContent = titles[surface] || 'Ultimate sports'
  window.scrollTo(0, 0)
}

function renderAll () {
  renderShell()
  renderSharedWallet()
  renderLanding()
  renderServer()
  renderDemo()
  renderDashboard()
  renderFits()
  renderTournaments()
  renderSurfaces()
  renderDesignSystem()
  renderAggregator()
  renderMma()
  renderGrind()
  setSurface(state.surface)
}

function renderSharedWallet () {
  const stored = loadSharedState()
  const wallet = stored.wallet || { balance: 500, currency: 'USDT', pendingPayout: 120 }
  const entered = stored.enteredPools || {}
  const activeCount = Object.keys(entered).length
  $('#walletAmt').textContent = `${Number(wallet.balance).toLocaleString('en-US')} ${wallet.currency || 'USDT'}`
  $('#activeSummary').textContent = activeCount
    ? `${activeCount} active pool${activeCount === 1 ? '' : 's'}`
    : 'No active pools'
}

function loadSharedState () {
  try {
    return JSON.parse(localStorage.getItem('pearcup-prototype') || 'null') || {}
  } catch {
    return {}
  }
}

function renderLanding () {
  const snapshot = state.snapshot
  const liveServers = snapshot.liveServers || {}
  const fits = snapshot.catalog.eventFits
  const activeServerIds = Object.keys(liveServers).filter(fitId => liveServers[fitId].status === 'live')

  $('#landingStatus').innerHTML = [
    pill(`${activeServerIds.length} live`, 'good'),
    pill(`${fits.length} sports`, 'good'),
    pill(`${snapshot.audit.summary.coveragePercent}% ready`, 'warn')
  ].join('')

  $('#landingHero').innerHTML = `
    <div class="hero-copy">
      <p class="eyebrow">PearCup v2</p>
      <h2>Pick a sport. Join a server. Play with friends.</h2>
      <p class="detail-copy">Each event fit runs its own themed server with live games, pools, watch rooms, and P2P mini-games. No central matchmaker required.</p>
    </div>
    <div class="hero-stats">
      <div class="hero-stat">
        <strong>${escapeHtml(activeServerIds.length)}</strong>
        <span>live servers</span>
      </div>
      <div class="hero-stat">
        <strong>${escapeHtml(fits.length)}</strong>
        <span>sports & events</span>
      </div>
      <div class="hero-stat">
        <strong>${escapeHtml(totalOnlinePlayers(liveServers))}</strong>
        <span>players online</span>
      </div>
    </div>
  `

  $('#activeServerGrid').innerHTML = activeServerIds.length
    ? activeServerIds.map(fitId => serverCard(liveServers[fitId], true)).join('')
    : `<p class="detail-copy">No live servers right now. Choose a sport below to host or join one.</p>`

  $$('#activeServerGrid [data-join-fit]').forEach(button => {
    button.addEventListener('click', () => joinServer(button.dataset.joinFit))
  })

  $('#sportGrid').innerHTML = fits.map(fit => {
    const liveServer = liveServers[fit.fitId]
    return serverCard({
      fitId: fit.fitId,
      title: fit.title,
      category: fit.category,
      status: liveServer ? liveServer.status : 'template',
      playerCount: liveServer ? liveServer.playerCount : 0,
      roomCount: liveServer ? liveServer.roomCount : 0,
      serverSkin: liveServer ? liveServer.serverSkin : 'catalog-lobby',
      serverLabel: liveServer ? liveServer.serverLabel : 'Template server',
      recommendedVariantCount: fit.recommendedVariants.length,
      recommendedMiniGameCount: fit.recommendedMiniGames.length
    }, false)
  }).join('')

  $$('#sportGrid [data-join-fit]').forEach(button => {
    button.addEventListener('click', () => joinServer(button.dataset.joinFit))
  })
}

function renderServer () {
  const snapshot = state.snapshot
  const liveServers = snapshot.liveServers || {}
  const server = liveServers[state.selectedServerFitId]
  if (!server) {
    $('#serverHeader').innerHTML = `
      <div>
        <p class="eyebrow">Server</p>
        <h1>No server selected</h1>
      </div>
      <button type="button" class="back-button" data-surface="landing">Back to lobby</button>
    `
    bindBackButton()
    return
  }

  const profile = findExperienceProfile(server.fitId) || {}
  $('#serverHeader').innerHTML = `
    <div class="server-hero" style="${skinStyle(server.serverSkin)}">
      <span class="server-category">${escapeHtml(server.category)}</span>
    </div>
    <div class="server-meta">
      <div>
        <p class="eyebrow">${escapeHtml(server.serverLabel)}</p>
        <h1 id="serverTitle">${escapeHtml(server.title)}</h1>
        <p class="detail-copy">${escapeHtml(profile.visualTone || server.title)}</p>
      </div>
      <div class="server-header-actions">
        ${pill(`${server.playerCount} online`, server.playerCount > 0 ? 'good' : 'warn')}
        ${pill(`${server.roomCount} rooms`, 'good')}
        <button type="button" class="back-button" data-surface="landing">Leave server</button>
      </div>
    </div>
  `
  bindBackButton()

  $$('[data-server-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.serverTab === state.selectedServerTab))
  $$('.server-tab-panel').forEach(panel => panel.classList.toggle('is-active', panel.id === `serverTab${capitalize(state.selectedServerTab)}`))

  if (state.selectedServerTab === 'games') renderServerGames(server)
  if (state.selectedServerTab === 'pools') renderServerPools(server)
  if (state.selectedServerTab === 'players') renderServerPlayers(server)
  if (state.selectedServerTab === 'minigames') renderServerMiniGames(server)
}

function renderServerGames (server) {
  $('#serverTabGames').innerHTML = `
    <div class="server-tab-header">
      <h2 id="serverGamesTitle">Live games & fixtures</h2>
      <span class="pill">${escapeHtml(server.fixtures.length)} matches</span>
    </div>
    <div class="fixture-list">
      ${server.fixtures.map(fixture => `
        <article class="fixture-card ${fixture.status}">
          <div class="fixture-status">
            <span class="pill is-${fixture.status === 'live' ? 'good' : fixture.status === 'finished' ? 'warn' : ''}">${escapeHtml(fixture.status)}</span>
            <span class="fixture-time">${escapeHtml(fixture.timeLabel)}</span>
          </div>
          <div class="fixture-teams">
            <div class="fixture-team">
              <strong>${escapeHtml(fixture.home)}</strong>
              ${fixture.homeScore != null ? `<span class="fixture-score">${escapeHtml(fixture.homeScore)}</span>` : ''}
            </div>
            <div class="fixture-vs">vs</div>
            <div class="fixture-team">
              <strong>${escapeHtml(fixture.away)}</strong>
              ${fixture.awayScore != null ? `<span class="fixture-score">${escapeHtml(fixture.awayScore)}</span>` : ''}
            </div>
          </div>
          <div class="fixture-actions">
            <button type="button" class="mini-button" data-watch="${escapeAttr(fixture.fixtureId)}">Watch</button>
            <button type="button" class="mini-button" data-pick="${escapeAttr(fixture.fixtureId)}">Pick</button>
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderServerPools (server) {
  $('#serverTabPools').innerHTML = `
    <div class="server-tab-header">
      <h2 id="serverPoolsTitle">Pools & leaderboards</h2>
      <span class="pill">${escapeHtml(server.pools.length)} open</span>
    </div>
    <div class="pool-list">
      ${server.pools.map(pool => `
        <article class="pool-card-live">
          <div class="route-header">
            <div>
              <h3>${escapeHtml(pool.title)}</h3>
              <span>${escapeHtml(pool.variant)} / ${escapeHtml(pool.mode)}</span>
            </div>
            ${pill(`${pool.entryCount} entries`, 'good')}
          </div>
          <div class="leaderboard">
            ${pool.leaderboard.slice(0, 5).map((entry, index) => `
              <div class="leaderboard-row">
                <span class="leaderboard-rank">${index + 1}</span>
                <span class="leaderboard-name">${escapeHtml(entry.name)}</span>
                <span class="leaderboard-score">${escapeHtml(entry.score)}</span>
              </div>
            `).join('')}
          </div>
          <button type="button" class="mini-button">Enter pool</button>
        </article>
      `).join('')}
    </div>
  `
}

function renderServerPlayers (server) {
  $('#serverTabPlayers').innerHTML = `
    <div class="server-tab-header">
      <h2 id="serverPlayersTitle">Players online</h2>
      <span class="pill">${escapeHtml(server.players.filter(p => p.status === 'online').length)} online</span>
    </div>
    <div class="player-grid">
      ${server.players.map(player => `
        <article class="player-card ${player.status}">
          <div class="player-avatar" aria-hidden="true">${escapeHtml(player.username.slice(0, 2).toUpperCase())}</div>
          <div>
            <strong>${escapeHtml(player.username)}</strong>
            <span>${escapeHtml(player.status)} · ${escapeHtml(player.activity)}</span>
          </div>
          <button type="button" class="mini-button">Challenge</button>
        </article>
      `).join('')}
    </div>
  `
}

function renderServerMiniGames (server) {
  $('#serverTabMinigames').innerHTML = `
    <div class="server-tab-header">
      <h2 id="serverMinigamesTitle">P2P mini-games</h2>
      <span class="pill">${escapeHtml(server.miniGames.length)} games</span>
    </div>
    <div class="minigame-grid">
      ${server.miniGames.map(game => `
        <article class="minigame-card">
          <div class="route-header">
            <div>
              <h3>${escapeHtml(game.title)}</h3>
              <span>${escapeHtml(game.mode)} · ${escapeHtml(game.commandType)}</span>
            </div>
          </div>
          <p class="detail-copy">${escapeHtml(game.headline)}</p>
          <div class="chip-row">
            ${game.controls.slice(0, 3).map(ctrl => `<span>${escapeHtml(ctrl)}</span>`).join('')}
          </div>
          <button type="button" class="mini-button">Play now</button>
        </article>
      `).join('')}
    </div>
  `
}

function renderDemo () {
  const scorePanel = $('#demoScorePanel')
  if (!scorePanel) return

  if (!state.demo) {
    const message = state.demoError ? state.demoError.message : 'Syncing live demo runtime'
    scorePanel.innerHTML = `
      <div>
        <div class="score-number">0</div>
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="chip-row">
        <span>live facade</span>
        <span>local runtime</span>
      </div>
    `
    $('#demoScenarioPanel').innerHTML = `<h3>Demo scripts</h3><p class="detail-copy">${escapeHtml(message)}</p>`
    $('#demoSurfacePanel').innerHTML = '<h3>Product surfaces</h3>'
    $('#demoRuntimePanel').innerHTML = '<h3>Runtime objects</h3>'
    return
  }

  const demo = state.demo
  const summary = demo.viewSummary || {}
  const applied = demo.appliedScenarios || []
  scorePanel.innerHTML = `
    <div>
      <div class="score-number">${escapeHtml(demo.runtime.eventCount)}</div>
      <p>runtime events</p>
    </div>
    <div class="chip-row">
      <span>${escapeHtml(demo.source)}</span>
      <span>root ${escapeHtml(demo.runtime.eventRoot)}</span>
      <span>${escapeHtml(demo.lastAction)}</span>
    </div>
  `

  $('#demoScenarioPanel').innerHTML = `
    <div class="route-header">
      <div>
        <h3>Demo scripts</h3>
        <span>${escapeHtml(applied.length)} applied</span>
      </div>
      ${pill(demo.transport && demo.transport.ok ? 'transport ok' : 'local only', demo.transport && demo.transport.ok ? 'good' : 'warn')}
    </div>
    <div class="demo-scenario-grid">
      ${(demo.availableScenarios || []).map(scenario => `
        <button type="button" class="demo-scenario-button" data-demo-scenario="${escapeAttr(scenario.scenarioId)}">
          <strong>${escapeHtml(scenario.title)}</strong>
          <span>${escapeHtml(scenario.scenarioId)}</span>
        </button>
      `).join('')}
    </div>
    ${applied.length ? `
      <h3>Applied</h3>
      <div class="surface-list">
        ${applied.map(run => `
          <div class="surface-row">
            <div>
              <strong>${escapeHtml(run.title)}</strong>
              <span>${escapeHtml(run.scenarioId)} / root ${escapeHtml(run.eventRoot)}</span>
            </div>
            <span>${escapeHtml(run.eventCount)} events</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `
  $$('#demoScenarioPanel [data-demo-scenario]').forEach(button => {
    button.addEventListener('click', async () => {
      await runDemoAction('./api/demo/apply-scenario', {
        scenarioId: button.dataset.demoScenario
      }, `${button.textContent.trim()} applied`)
    })
  })

  $('#demoSurfacePanel').innerHTML = `
    <div class="route-header">
      <div>
        <h3>Live surfaces</h3>
        <span>${escapeHtml(summary.surfaceCount || 0)} mounted</span>
      </div>
      ${pill(`${summary.competitionCount || 0} competitions`, summary.competitionCount ? 'good' : 'warn')}
    </div>
    <div class="surface-list">
      ${(demo.surfaceSummary || []).map(surface => `
        <div class="surface-row">
          <div>
            <strong>${escapeHtml(surface.title)}</strong>
            <span>${escapeHtml(surface.surfaceId)}</span>
          </div>
          <span>${escapeHtml(surface.primaryCount)} / ${escapeHtml(surface.badgeCount)}</span>
        </div>
      `).join('')}
    </div>
  `

  $('#demoRuntimePanel').innerHTML = `
    <div class="route-header">
      <div>
        <h3>Runtime objects</h3>
        <span>${escapeHtml(formatDate(demo.generatedAt))}</span>
      </div>
      ${pill(`${summary.poolCount || 0} pools / ${summary.roomCount || 0} rooms`, summary.poolCount ? 'good' : 'warn')}
    </div>
    <div class="detail-list compact">
      <div><span>Competitions</span><strong>${escapeHtml(summary.competitionCount || 0)}</strong></div>
      <div><span>Pools</span><strong>${escapeHtml(summary.poolCount || 0)}</strong></div>
      <div><span>Rooms</span><strong>${escapeHtml(summary.roomCount || 0)}</strong></div>
      <div><span>Wallets</span><strong>${escapeHtml(summary.walletCount || 0)}</strong></div>
    </div>
    <div class="runtime-columns">
      ${renderDemoCollection('Competitions', demo.competitions, item => `
        <strong>${escapeHtml(item.title || item.competitionId)}</strong>
        <span>${escapeHtml(item.templateKind || item.status)} / ${escapeHtml(item.fixtureCount)} fixtures</span>
      `)}
      ${renderDemoCollection('Pools', demo.pools, item => `
        <strong>${escapeHtml(item.title || item.poolId)}</strong>
        <span>${escapeHtml(item.variant || item.status)}</span>
      `)}
      ${renderDemoCollection('Rooms', demo.rooms, item => `
        <strong>${escapeHtml(item.title || item.roomId)}</strong>
        <span>${escapeHtml(item.status)} / ${escapeHtml(item.participantCount)} participants</span>
      `)}
      ${renderDemoCollection('Wallets', demo.wallets, item => `
        <strong>${escapeHtml(item.currency || item.walletId)}</strong>
        <span>${escapeHtml(item.userId || 'user')} / ${escapeHtml(item.balance || 0)}</span>
      `)}
      ${renderDemoWorkbenches(demo.workbenches)}
      ${renderDemoCollection('Recent events', demo.recentEvents, item => `
        <strong>${escapeHtml(item.type)}</strong>
        <span>${escapeHtml(item.aggregateId || item.eventId)}</span>
      `)}
    </div>
  `
}

function renderDemoCollection (title, items, renderItem) {
  const rows = (items || []).slice(0, 8)
  return `
    <section class="runtime-column">
      <h3>${escapeHtml(title)}</h3>
      <div class="runtime-list">
        ${rows.length
          ? rows.map(item => `<div class="runtime-row">${renderItem(item)}</div>`).join('')
          : '<p class="detail-copy">None yet.</p>'}
      </div>
    </section>
  `
}

function renderDemoWorkbenches (workbenches) {
  const entries = Object.entries(workbenches || {})
  return `
    <section class="runtime-column">
      <h3>Workbenches</h3>
      <div class="runtime-list">
        ${entries.map(([key, workbench]) => `
          <div class="runtime-row">
            <strong>${escapeHtml(key)}</strong>
            <span>${escapeHtml(workbench.available ? workbench.title : workbench.error)}</span>
            <div class="chip-row">
              ${Object.entries(workbench.counts || {}).slice(0, 3).map(([countKey, value]) => `<span>${escapeHtml(countKey)} ${escapeHtml(value)}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderShell () {
  const snapshot = state.snapshot
  const audit = snapshot.audit
  $('#snapshotVersion').textContent = snapshot.snapshotVersion.replace('ultimate-sports-', '')
  $('#snapshotTime').innerHTML = `<span class="pill">Generated ${formatDate(snapshot.generatedAt)}</span>`
  $('#statusStrip').innerHTML = [
    pill(`${audit.summary.coveragePercent}% coverage`, 'good'),
    pill(audit.status.replaceAll('-', ' '), 'warn'),
    pill(`${snapshot.runtime.eventCount} runtime events`, 'good')
  ].join('')
  $('#sideReadout').innerHTML = [
    readout('Event fits', audit.summary.fitCount),
    readout('Mini-game plans', audit.summary.miniGameRunPlans),
    readout('Open grind', audit.summary.topGapCount)
  ].join('')
}

function renderDashboard () {
  const snapshot = state.snapshot
  const audit = snapshot.audit
  const fitReadiness = audit.fitReadiness
  $('#scorePanel').innerHTML = `
    <div>
      <div class="score-number">${escapeHtml(audit.summary.coveragePercent)}%</div>
      <p>${escapeHtml(audit.status.replaceAll('-', ' '))}</p>
    </div>
    <div class="chip-row">
      <span>${escapeHtml(audit.summary.launchableFits)} launchable fits</span>
      <span>${escapeHtml(audit.summary.aggregatorRoutes)} aggregator routes</span>
      <span>${escapeHtml(audit.summary.scenarioPasses)}/${escapeHtml(audit.summary.scenarioCount)} scenarios</span>
    </div>
  `
  const readiness = audit.launchReadiness
  $('#readinessPanel').innerHTML = readiness ? `
    <h3>Launch Readiness Gates</h3>
    <div class="surface-list">
      ${readiness.gates.map(gate => `
        <div class="surface-row">
          <div>
            <strong>${escapeHtml(gate.title)}</strong>
            <span>${escapeHtml(gate.evidence)}</span>
          </div>
          ${pill(gate.status, gate.status === 'passed' ? 'good' : gate.status === 'ready' ? 'warn' : 'hot')}
        </div>
      `).join('')}
    </div>
    <p class="detail-copy">Current level: ${escapeHtml(readiness.summary.currentLevelId)}. Next blocked gate: ${escapeHtml(readiness.summary.nextBlockedGateId || 'none')}.</p>
  ` : ''
  $('#fitReadinessPanel').innerHTML = fitReadiness ? `
    <div class="route-header">
      <div>
        <h3>Fit Readiness Matrix</h3>
        <p class="detail-copy">${escapeHtml(fitReadiness.summary.fullyReadyFitCount)} no-blocker fits / ${escapeHtml(fitReadiness.summary.providerBlockedFitCount)} provider-blocked / ${escapeHtml(fitReadiness.summary.qvacLocalReadyCount)} QVAC-local.</p>
      </div>
      ${pill(`${fitReadiness.summary.blockedFitCount} blocked`, fitReadiness.summary.blockedFitCount ? 'hot' : 'good')}
    </div>
    <div class="surface-list">
      ${fitReadiness.rows.map(row => `
        <div class="surface-row readiness-row">
          <div>
            <strong>${escapeHtml(row.title)}</strong>
            <span>${escapeHtml(row.sourceMode)} / ${escapeHtml(row.settlementMode)} / ${escapeHtml(row.statuses.assets)}</span>
          </div>
          <div class="mini-stats">
            <span>${escapeHtml(row.statuses.demo)}</span>
            <span>${escapeHtml(row.statuses.liveData)}</span>
            <span>${escapeHtml(row.qvacRefereeLane.active ? row.qvacRefereeLane.mode : 'no qvac')}</span>
          </div>
        </div>
      `).join('')}
    </div>
  ` : ''
  $('#coveragePanel').innerHTML = `
    <h3>Coverage Areas</h3>
    <div class="metric-grid">
      ${audit.coverage.areas.map(area => `
        <article class="metric-card">
          <strong class="metric-value">${escapeHtml(area.covered)}/${escapeHtml(area.total)}</strong>
          <div>
            <h3>${escapeHtml(area.title)}</h3>
            <span>${escapeHtml(area.evidence)}</span>
          </div>
          <div class="metric-bar"><i style="width:${boundPercent(area.percent)}%"></i></div>
        </article>
      `).join('')}
    </div>
  `
  $('#scenarioPanel').innerHTML = `
    <h3>Scenario Replay</h3>
    <div class="scenario-list">
      ${snapshot.runtime.scenarioRuns.map(run => `
        <article class="scenario-card">
          <div class="route-header">
            <div>
              <h3>${escapeHtml(run.title || run.scenarioId)}</h3>
              <span>${escapeHtml(run.scenarioId)}</span>
            </div>
            ${pill(run.ok ? 'pass' : 'fail', run.ok ? 'good' : 'hot')}
          </div>
          <div class="mini-stats">
            <span>${escapeHtml(run.commandCount || 0)} commands</span>
            <span>${escapeHtml(run.eventCount || 0)} events</span>
            <span>${escapeHtml(run.topicCount || 0)} topics</span>
          </div>
        </article>
      `).join('')}
    </div>
  `
  $('#surfacePanel').innerHTML = `
    <h3>Facade Surfaces</h3>
    <div class="surface-list">
      ${snapshot.navigation.map(item => `
        <div class="surface-row">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.surfaceId)}</span>
          </div>
          <span>${escapeHtml(item.primaryCount)} primary / ${escapeHtml(item.badgeCount)} badge</span>
        </div>
      `).join('')}
    </div>
  `
}

function renderFits () {
  const snapshot = state.snapshot
  const fits = snapshot.catalog.eventFits
  $('#fitSelect').innerHTML = fits.map(fit => `
    <option value="${escapeAttr(fit.fitId)}" ${fit.fitId === state.selectedFitId ? 'selected' : ''}>${escapeHtml(fit.title)}</option>
  `).join('')
  $('#fitGrid').innerHTML = fits.map(fit => {
    const row = launchRow(fit.fitId)
    const route = routeForFit(fit.fitId)
    return `
      <button class="fit-card ${fit.fitId === state.selectedFitId ? 'is-selected' : ''}" type="button" data-fit-id="${escapeAttr(fit.fitId)}">
        <div class="route-header">
          <div>
            <h3>${escapeHtml(fit.title)}</h3>
            <p>${escapeHtml(fit.category)} / ${escapeHtml(fit.entrantShape)}</p>
          </div>
          ${pill(row && row.primary.launchable ? 'launch' : 'needs plan', row && row.primary.launchable ? 'good' : 'hot')}
        </div>
        <div class="mini-stats">
          <span>${escapeHtml(fit.recommendedVariants.length)} variants</span>
          <span>${escapeHtml(fit.recommendedMiniGames.length)} games</span>
          <span>${escapeHtml(route ? route.primarySourceId : 'no route')}</span>
        </div>
      </button>
    `
  }).join('')
  $$('#fitGrid [data-fit-id]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedFitId = button.dataset.fitId
      state.selectedRouteFitId = button.dataset.fitId
      renderFits()
      renderAggregator()
    })
  })
  renderFitDetail()
}

function renderFitDetail () {
  const fit = findFit(state.selectedFitId)
  const row = launchRow(state.selectedFitId)
  const route = routeForFit(state.selectedFitId)
  if (!fit || !row) {
    $('#fitDetail').innerHTML = '<h3>No fit selected</h3>'
    return
  }
  $('#fitDetail').innerHTML = `
    <div class="route-header">
      <div>
        <h3>${escapeHtml(fit.title)}</h3>
        <p class="detail-copy">${escapeHtml(fit.resultPolicy)} result policy</p>
      </div>
      ${pill(`${row.primary.commandCount} commands`, 'good')}
    </div>
    <div class="detail-list">
      <div><span>Template kinds</span><strong>${escapeHtml(fit.templateKinds.join(', '))}</strong></div>
      <div><span>Primary source</span><strong>${escapeHtml(route ? route.primarySourceId : 'missing')}</strong></div>
      <div><span>Auto settlement</span><strong>${escapeHtml(route && route.autoSettlementSourceIds.length ? route.autoSettlementSourceIds.join(', ') : 'QVAC/manual evidence')}</strong></div>
      <div><span>Launch checklist</span><strong>${escapeHtml(row.checklist.join(', '))}</strong></div>
    </div>
    <h3>Variants</h3>
    <div class="variant-list">
      ${row.variantCoverage.map(item => `<span class="variant-chip ${item.coverage !== 'missing' ? 'is-covered' : ''}">${escapeHtml(item.title)}</span>`).join('')}
    </div>
    <h3>Mini-games</h3>
    <div class="game-list">
      ${row.miniGameCoverage.map(item => `<span class="game-chip ${item.coverage !== 'missing' ? 'is-covered' : ''}">${escapeHtml(item.title)}</span>`).join('')}
    </div>
  `
}

function renderAggregator () {
  const snapshot = state.snapshot
  const routes = snapshot.aggregator.routes
  const smoke = snapshot.sportsDataSmoke
  $('#routeSelect').innerHTML = routes.map(route => `
    <option value="${escapeAttr(route.fitId)}" ${route.fitId === state.selectedRouteFitId ? 'selected' : ''}>${escapeHtml(route.title)}</option>
  `).join('')
  const route = routeForFit(state.selectedRouteFitId) || routes[0]
  if (!route) return
  $('#routeDetail').innerHTML = `
    <div class="route-header">
      <div>
        <h3>${escapeHtml(route.title)}</h3>
        <p class="detail-copy">${escapeHtml(route.category)} route</p>
      </div>
      ${pill(route.autoSettlementSourceIds.length ? 'auto source' : 'QVAC fallback', route.autoSettlementSourceIds.length ? 'good' : 'warn')}
    </div>
    <div class="detail-list">
      <div><span>Primary</span><strong>${escapeHtml(route.primarySourceId)}</strong></div>
      <div><span>Sources</span><strong>${escapeHtml(route.sourceIds.join(', '))}</strong></div>
      <div><span>Env needed</span><strong>${escapeHtml(route.envVars.length ? route.envVars.join(', ') : 'none')}</strong></div>
      <div><span>Fallback</span><strong>${escapeHtml(route.fallbackOrder.length ? route.fallbackOrder.join(', ') : 'not required')}</strong></div>
    </div>
    <div class="route-list">
      ${route.sourceIds.map(sourceId => `<span class="route-chip">${escapeHtml(sourceId)}</span>`).join('')}
    </div>
  `
  $('#sourceStack').innerHTML = `
    <h3>Sources</h3>
    <div class="source-list">
      ${snapshot.aggregator.sources.map(source => `
        <div class="source-row">
          <div>
            <strong>${escapeHtml(source.title)}</strong>
            <span>${escapeHtml(source.role)} / ${escapeHtml(source.settlementTier)}</span>
          </div>
          ${pill(source.usage, source.usage === 'primary' || source.usage === 'specialist' ? 'good' : 'warn')}
        </div>
      `).join('')}
    </div>
  `
  $('#clientPanel').innerHTML = `
    <div class="route-header">
      <div>
        <h3>Server-side Clients</h3>
        <p class="detail-copy">${escapeHtml(snapshot.sportsDataClients.coverage.apiClientsWithRequestBuilders)}/${escapeHtml(snapshot.sportsDataClients.coverage.apiSourceCount)} API-backed sources have request builders. ${escapeHtml(snapshot.sportsDataClients.coverage.readyApiClients)} have required env in this snapshot.</p>
      </div>
      ${pill(`${snapshot.sportsDataClients.coverage.readyApiClients} live-ready`, snapshot.sportsDataClients.coverage.readyApiClients ? 'good' : 'warn')}
    </div>
    ${smoke ? `
      <div class="detail-list compact">
        <div><span>Smoke status</span><strong>${escapeHtml(smoke.overallStatus.replaceAll('-', ' '))}</strong></div>
        <div><span>Ready checks</span><strong>${escapeHtml(smoke.summary.readyToRun)}/${escapeHtml(smoke.summary.apiChecks)} API</strong></div>
        <div><span>Blocked checks</span><strong>${escapeHtml(smoke.summary.blocked)}</strong></div>
        <div><span>Local lanes</span><strong>${escapeHtml(smoke.summary.localReady)}</strong></div>
      </div>
      ${smoke.latestReport ? `
        <div class="handoff-panel">
          <div class="route-header">
            <div>
              <h3>Latest Smoke Report</h3>
              <p class="detail-copy">${escapeHtml(smoke.latestReport.overallStatus.replaceAll('-', ' '))} / ${escapeHtml(smoke.latestReport.summary.passedChecks)}/${escapeHtml(smoke.latestReport.summary.totalChecks)} passed</p>
            </div>
            ${pill(smoke.latestReport.standupFixtures ? 'fixtures' : 'live', smoke.latestReport.summary.failed || smoke.latestReport.summary.skipped ? 'warn' : 'good')}
          </div>
          <div class="mini-stats">
            <span>${escapeHtml(smoke.latestReport.summary.passedFixture)} fixture</span>
            <span>${escapeHtml(smoke.latestReport.summary.passedLocal)} local</span>
            <span>${escapeHtml(smoke.latestReport.summary.passedLive)} live</span>
          </div>
        </div>
      ` : ''}
    ` : ''}
    <div class="provider-grid">
      ${snapshot.sportsDataClients.clients.map(client => {
        const smokeCheck = smokeCheckFor(client.sourceId)
        return `
        <article class="provider-card">
          <div class="route-header">
            <div>
              <h3>${escapeHtml(client.title)}</h3>
              <span>${escapeHtml(client.sourceId)} / ${escapeHtml(client.clientKind)}</span>
            </div>
            ${pill(smokeCheck ? smokeCheck.status.replaceAll('-', ' ') : client.localEvidenceLane ? 'local' : client.readyForLiveRequests ? 'ready' : 'missing env', client.localEvidenceLane || client.readyForLiveRequests || smokeCheck && smokeCheck.status === 'ready-to-run' ? 'good' : 'warn')}
          </div>
          <div class="chip-row">
            <span>${escapeHtml(client.operationCount)} ops</span>
            <span>${escapeHtml(client.settlementTier)}</span>
            ${smokeCheck ? `<span>${escapeHtml(smokeCheck.operation)}</span>` : ''}
          </div>
          <p class="detail-copy">${escapeHtml(client.missingEnv.length ? `Missing ${client.missingEnv.join(', ')}` : 'No required secrets for this local lane.')}</p>
          ${smokeCheck && smokeCheck.nextAction ? `<p class="detail-copy"><strong>Next:</strong> ${escapeHtml(smokeCheck.nextAction)}</p>` : ''}
          ${smokeCheck && smokeCheck.acceptanceCriteria ? `<ul>${smokeCheck.acceptanceCriteria.slice(0, 2).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
        </article>
      `}).join('')}
    </div>
  `
  $('#providerPanel').innerHTML = `
    <h3>Provider Coverage</h3>
    <div class="provider-grid">
      ${snapshot.providers.providers.map(provider => `
        <article class="provider-card">
          <div class="route-header">
            <div>
              <h3>${escapeHtml(provider.title)}</h3>
              <span>${escapeHtml(provider.role)}</span>
            </div>
            ${pill(provider.providerId, 'good')}
          </div>
          <div class="chip-row">${provider.coverage.slice(0, 6).map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
          <ul>
            ${provider.strengths.slice(0, 2).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
      `).join('')}
    </div>
  `
}

function renderMma () {
  const snapshot = state.snapshot
  const mma = snapshot.assets.mma
  const generated = snapshot.audit && snapshot.audit.generatedAssets && snapshot.audit.generatedAssets.mmaCard
  const route = routeForFit('mma-boxing-fight-card')
  $('#mmaQueueCount').textContent = `${mma.queueCount} Higgsfield jobs`
  $('#mmaStyle').innerHTML = `
    <div class="route-header">
      <div>
        <h3>${escapeHtml(mma.title)}</h3>
        <p class="detail-copy">${escapeHtml(mma.style.aesthetic)}</p>
      </div>
      ${pill(mma.provider, 'warn')}
    </div>
    ${generated ? `
      <div class="detail-list compact">
        <div><span>Generated status</span><strong>${escapeHtml(generated.overallStatus.replaceAll('-', ' '))}</strong></div>
        <div><span>Output targets</span><strong>${escapeHtml(generated.summary.presentTargets)}/${escapeHtml(generated.summary.targetCount)}</strong></div>
        <div><span>Ready for QA</span><strong>${escapeHtml(generated.summary.readyForQaTargets)}</strong></div>
        <div><span>Missing</span><strong>${escapeHtml(generated.summary.missingTargets)}</strong></div>
      </div>
      ${generated.generationHandoff ? `
        <div class="handoff-panel">
          <h3>Generation Handoff</h3>
          <p class="detail-copy">${escapeHtml(generated.generationHandoff.queueJobCount)} jobs / ${escapeHtml(generated.generationHandoff.targetCount)} outputs. Env: ${escapeHtml(generated.generationHandoff.envVars.join(', '))}</p>
          <ul>
            ${generated.generationHandoff.nextActions.slice(0, 3).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    ` : ''}
    <div class="style-token-grid">
      ${mma.style.tokens.slice(0, 8).map(token => `<span>${escapeHtml(token)}</span>`).join('')}
    </div>
  `
  $('#mmaAssets').innerHTML = `
    <h3>Required Asset Pack</h3>
    <div class="asset-grid">
      ${mma.assets.map(asset => `
        <article class="asset-card">
          <h3>${escapeHtml(asset.title)}</h3>
          <span>${escapeHtml(asset.assetType)}</span>
          <div class="chip-row">
            <span>${escapeHtml(asset.resolution)}</span>
            <span>${escapeHtml(asset.aspectRatios.join(', '))}</span>
            <span>${escapeHtml(asset.variants.length)} variants</span>
          </div>
        </article>
      `).join('')}
    </div>
  `
  $('#mmaApis').innerHTML = `
    <h3>Combat Route</h3>
    <div class="api-list">
      <div class="api-row">
        <div>
          <strong>${escapeHtml(route ? route.primarySourceId : 'missing route')}</strong>
          <span>official fight-card source</span>
        </div>
        ${pill(route && route.autoSettlementSourceIds.length ? 'settles' : 'review', route && route.autoSettlementSourceIds.length ? 'good' : 'warn')}
      </div>
      ${snapshot.aggregator.sources
        .filter(source => route && route.sourceIds.includes(source.sourceId))
        .map(source => `
          <div class="api-row">
            <div>
              <strong>${escapeHtml(source.title)}</strong>
              <span>${escapeHtml(source.role)}</span>
              <code>${escapeHtml(source.env.length ? source.env.join(', ') : 'no env')}</code>
            </div>
            ${pill(source.usage, source.usage === 'primary' ? 'good' : 'warn')}
          </div>
        `).join('')}
    </div>
  `
}

function renderGrind () {
  const grind = state.snapshot.audit.grindList
  const matrix = state.snapshot.audit.grindMatrix
  const backlog = state.snapshot.audit.grindBacklog
  const open = grind.filter(item => item.status !== 'covered')
  $('#openGapCount').textContent = matrix
    ? `${open.length} gaps / ${matrix.summary.openTaskCount} tasks`
    : `${open.length} open`
  const summaryCards = grind.map(item => `
    <article class="grind-card ${item.status === 'covered' ? 'is-covered' : 'is-open'}">
      <div class="route-header">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <span>${escapeHtml(item.area)}</span>
        </div>
        ${pill(`${item.priority} / ${item.status}`, item.status === 'covered' ? 'good' : item.priority === 'P0' ? 'hot' : 'warn')}
      </div>
      <p class="live-copy">${escapeHtml(item.evidence)}</p>
      <p class="detail-copy">${escapeHtml(item.nextStep)}</p>
    </article>
  `).join('')
  const matrixMarkup = matrix ? `
    <section class="grind-matrix">
      <div class="route-header">
        <div>
          <h3>Concrete Grind Matrix</h3>
          <span>${escapeHtml(matrix.summary.openTaskCount)} open tasks / ${escapeHtml(matrix.summary.blockedTaskCount)} blocked</span>
        </div>
        ${pill(`${matrix.summary.taskCount} tasks`, 'warn')}
      </div>
      <div class="grind-group-list">
        ${matrix.groups.map(group => `
          <article class="grind-group">
            <div class="route-header">
              <div>
                <h3>${escapeHtml(group.title)}</h3>
                <span>${escapeHtml(group.priority)} / ${escapeHtml(group.status)}</span>
              </div>
              ${pill(`${group.tasks.length} tasks`, group.status === 'blocked' ? 'hot' : 'good')}
            </div>
            <p class="detail-copy">${escapeHtml(group.summary)}</p>
            <code>${escapeHtml(group.command)}</code>
            <div class="task-list">
              ${group.tasks.map(task => `
                <div class="task-row">
                  <div>
                    <strong>${escapeHtml(task.title)}</strong>
                    <span>${escapeHtml(task.taskId)}</span>
                    <p class="detail-copy">${escapeHtml(task.nextAction)}</p>
                  </div>
                  ${pill(task.status, task.status === 'blocked' ? 'hot' : task.status === 'covered' || task.status === 'ready-for-qa' ? 'good' : 'warn')}
                </div>
              `).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  ` : ''
  const backlogMarkup = backlog ? `
    <section class="grind-matrix">
      <div class="route-header">
        <div>
          <h3>Actionable Backlog</h3>
          <span>${escapeHtml(backlog.summary.ticketCount)} tickets / ${escapeHtml(backlog.summary.externalDependencyTicketCount)} external dependencies</span>
        </div>
        ${pill(`${backlog.summary.blockedTicketCount} blocked`, backlog.summary.blockedTicketCount ? 'hot' : 'good')}
      </div>
      <div class="task-list">
        ${backlog.tickets.map(ticket => `
          <div class="task-row">
            <div>
              <strong>${escapeHtml(ticket.ticketId)} · ${escapeHtml(ticket.title)}</strong>
              <span>${escapeHtml(ticket.ownerLane)} / ${escapeHtml(ticket.workstream)}</span>
              <p class="detail-copy">${escapeHtml(ticket.nextAction)}</p>
              <code>${escapeHtml(ticket.command || '')}</code>
            </div>
            ${pill(ticket.status, ticket.status === 'blocked' ? 'hot' : ticket.status === 'ready' ? 'good' : 'warn')}
          </div>
        `).join('')}
      </div>
    </section>
  ` : ''
  $('#grindBoard').innerHTML = `${summaryCards}${matrixMarkup}${backlogMarkup}`
}

function renderTournaments () {
  const snapshot = state.snapshot
  const lobby = snapshot.tournamentLobby
  const fits = snapshot.catalog.eventFits
  const shellEntry = findTournamentShell(state.selectedTournamentFitId)
  const experience = shellEntry && shellEntry.shell.selectedExperience
  const shell = shellEntry && shellEntry.shell.shell

  $('#tournamentSelect').innerHTML = fits.map(fit => `
    <option value="${escapeAttr(fit.fitId)}" ${fit.fitId === state.selectedTournamentFitId ? 'selected' : ''}>${escapeHtml(fit.title)}</option>
  `).join('')

  $('#tournamentServerRail').innerHTML = `
    <div class="section-title">
      <div>
        <p class="eyebrow">${escapeHtml(lobby.state)} lobby</p>
        <h3>${escapeHtml(lobby.activeServerCount)} active servers</h3>
      </div>
    </div>
    <div class="server-rail-grid">
      ${lobby.catalogServers.map(server => `
        <button class="server-card ${server.fitId === state.selectedTournamentFitId ? 'is-selected' : ''}" type="button" data-tournament-fit="${escapeAttr(server.fitId)}">
          <div class="server-skin" style="${skinStyle(server.serverSkin)}"></div>
          <div>
            <h3>${escapeHtml(server.title)}</h3>
            <span>${escapeHtml(server.category)} / ${escapeHtml(server.serverLabel)}</span>
          </div>
          <div class="mini-stats">
            <span>${escapeHtml(server.recommendedVariantCount)} variants</span>
            <span>${escapeHtml(server.recommendedMiniGameCount)} games</span>
          </div>
        </button>
      `).join('')}
    </div>
  `
  $$('#tournamentServerRail [data-tournament-fit]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedTournamentFitId = button.dataset.tournamentFit
      renderTournaments()
    })
  })

  if (!experience) {
    $('#tournamentExperience').innerHTML = '<h3>No tournament selected</h3>'
    $('#tournamentShell').innerHTML = ''
    $('#tournamentAssetQueue').innerHTML = ''
    return
  }

  $('#tournamentExperience').innerHTML = `
    <div class="route-header">
      <div>
        <h3>${escapeHtml(experience.title)}</h3>
        <span>${escapeHtml(experience.server.serverLabel)} / ${escapeHtml(experience.category)}</span>
      </div>
      ${pill(experience.status, experience.status === 'template' ? 'warn' : 'good')}
    </div>
    <div class="detail-list compact">
      <div><span>Shell</span><strong>${escapeHtml(experience.gui.shellId)}</strong></div>
      <div><span>Layout</span><strong>${escapeHtml(experience.gui.layoutMode)}</strong></div>
      <div><span>Bracket</span><strong>${escapeHtml(experience.competition.bracketStyle)}</strong></div>
      <div><span>Result policy</span><strong>${escapeHtml(experience.server.resultPolicy)}</strong></div>
    </div>
    <h3>Theme</h3>
    <p class="detail-copy">${escapeHtml(experience.assetPack.visualTone)}</p>
    <div class="palette-row">
      ${experience.assetPack.palette.map(color => `<span class="color-swatch" style="background:${swatchColor(color)}" title="${escapeAttr(color)}"></span>`).join('')}
    </div>
    <h3>Live prompt lexicon</h3>
    <div class="style-token-grid">
      ${experience.miniGameDock.promptLexicon.map(token => `<span>${escapeHtml(token)}</span>`).join('')}
    </div>
  `

  $('#tournamentShell').innerHTML = `
    <h3>GUI Shell</h3>
    <div class="detail-list compact">
      <div><span>Route</span><strong>${escapeHtml(shell.route)}</strong></div>
      <div><span>Shell ID</span><strong>${escapeHtml(shell.shellId)}</strong></div>
      <div><span>Density</span><strong>${escapeHtml(shell.theme.density)}</strong></div>
      <div><span>Motion</span><strong>${escapeHtml(shell.theme.motion)}</strong></div>
    </div>
    <h3>Route map</h3>
    <div class="route-list">
      ${shell.routeMap.map(item => `<span class="route-chip ${item.selected ? 'is-covered' : ''}">${escapeHtml(item.title)}</span>`).join('')}
    </div>
    <h3>Screen slots</h3>
    <div class="slot-list">
      ${shell.screenSlots.map(item => `
        <div class="slot-row">
          <strong>${escapeHtml(item.slotId)}</strong>
          <span>${escapeHtml(item.surfaceId)} / ${escapeHtml(item.component)}</span>
        </div>
      `).join('')}
    </div>
    <h3>Mini-game dock</h3>
    <div class="game-list">
      ${shell.miniGameDock.map(item => `<span class="game-chip">${escapeHtml(item.title)}</span>`).join('')}
    </div>
  `

  $('#tournamentAssetQueue').innerHTML = `
    <h3>Asset queue</h3>
    <div class="asset-queue-list">
      ${experience.assetPack.requiredAssets.map((asset, index) => `
        <div class="asset-queue-row">
          <div>
            <strong>${escapeHtml(asset.assetType)}</strong>
            <span>${escapeHtml(asset.acceptance)}</span>
          </div>
          ${pill(String(index + 1), 'warn')}
        </div>
      `).join('')}
    </div>
  `
}

function renderSurfaces () {
  const snapshot = state.snapshot
  const surfaceIds = snapshot.navigation.map(item => item.surfaceId)
  const selectedSurfaceId = surfaceIds.includes(state.selectedSurfaceId) ? state.selectedSurfaceId : surfaceIds[0]
  const surface = snapshot.surfaces[selectedSurfaceId]

  $('#surfaceSelect').innerHTML = snapshot.navigation.map(item => `
    <option value="${escapeAttr(item.surfaceId)}" ${item.surfaceId === selectedSurfaceId ? 'selected' : ''}>${escapeHtml(item.title)}</option>
  `).join('')

  const navItem = snapshot.navigation.find(item => item.surfaceId === selectedSurfaceId)
  $('#surfaceDetail').innerHTML = `
    <div class="route-header">
      <div>
        <h3>${escapeHtml(surface.title)}</h3>
        <span>${escapeHtml(surface.surfaceId)}</span>
      </div>
      ${pill(`${navItem.primaryCount} items`, 'good')}
    </div>
    <div class="detail-list compact">
      ${Object.entries(surface.counts || {}).map(([key, value]) => `
        <div><span>${escapeHtml(key.replace(/([A-Z])/g, ' $1').toLowerCase())}</span><strong>${escapeHtml(value)}</strong></div>
      `).join('')}
    </div>
  `

  $('#surfaceContent').innerHTML = renderSurfaceContent(surface)
}

function renderSurfaceContent (surface) {
  const sections = []
  if (surface.eventFits && surface.eventFits.length) {
    sections.push(`
      <h3>Event fits</h3>
      <div class="fit-grid compact">
        ${surface.eventFits.map(fit => `
          <article class="fit-card">
            <h3>${escapeHtml(fit.title)}</h3>
            <span>${escapeHtml(fit.category)}</span>
            <div class="mini-stats">
              <span>${escapeHtml(fit.recommendedVariantCount)} variants</span>
              <span>${escapeHtml(fit.recommendedMiniGameCount)} games</span>
            </div>
          </article>
        `).join('')}
      </div>
    `)
  }
  if (surface.liveNow && surface.liveNow.length) {
    sections.push(`
      <h3>Live now</h3>
      <div class="room-grid">
        ${surface.liveNow.map(room => `
          <article class="room-card">
            <h3>${escapeHtml(room.title)}</h3>
            <span>${escapeHtml(room.status)} / ${escapeHtml(room.participantCount)} participants</span>
          </article>
        `).join('')}
      </div>
    `)
  }
  if (surface.yourPools && surface.yourPools.length) {
    sections.push(`
      <h3>Your pools</h3>
      <div class="pool-grid">
        ${surface.yourPools.map(pool => `
          <article class="pool-card">
            <h3>${escapeHtml(pool.title)}</h3>
            <span>${escapeHtml(pool.variant || pool.status)}</span>
          </article>
        `).join('')}
      </div>
    `)
  }
  if (surface.activeDuels && surface.activeDuels.length) {
    sections.push(`
      <h3>Active duels</h3>
      <div class="duel-grid">
        ${surface.activeDuels.map(duel => `
          <article class="duel-card">
            <h3>${escapeHtml(duel.challengeType)}</h3>
            <span>${escapeHtml(duel.status)}</span>
          </article>
        `).join('')}
      </div>
    `)
  }
  if (surface.competitionDrafts && surface.competitionDrafts.length) {
    sections.push(`
      <h3>Competition drafts</h3>
      <div class="draft-grid">
        ${surface.competitionDrafts.map(draft => `
          <article class="draft-card">
            <h3>${escapeHtml(draft.title)}</h3>
            <span>${escapeHtml(draft.templateKind || draft.status)}</span>
          </article>
        `).join('')}
      </div>
    `)
  }
  if (surface.accounts && surface.accounts.length) {
    sections.push(`
      <h3>Wallet accounts</h3>
      <div class="wallet-grid">
        ${surface.accounts.map(account => `
          <article class="wallet-card">
            <h3>${escapeHtml(account.currency)}</h3>
            <span>${escapeHtml(account.mode)} / ${escapeHtml(account.status)}</span>
          </article>
        `).join('')}
      </div>
    `)
  }
  if (surface.qvacResultEvidence && surface.qvacResultEvidence.length) {
    sections.push(`
      <h3>QVAC result evidence</h3>
      <div class="evidence-grid">
        ${surface.qvacResultEvidence.map(record => `
          <article class="evidence-card">
            <h3>${escapeHtml(record.status)}</h3>
            <span>${escapeHtml(record.targetType)} / ${escapeHtml(record.targetId)}</span>
          </article>
        `).join('')}
      </div>
    `)
  }
  if (surface.workbench) {
    sections.push(`
      <h3>Workbench</h3>
      <pre class="workbench-json">${escapeHtml(JSON.stringify(surface.workbench, null, 2)).slice(0, 1200)}</pre>
    `)
  }
  return sections.length ? sections.join('') : '<p class="detail-copy">No preview content for this surface.</p>'
}

function renderDesignSystem () {
  const snapshot = state.snapshot
  const fits = snapshot.catalog.eventFits
  const fitId = state.selectedDesignFitId
  const fit = fits.find(item => item.fitId === fitId)
  const profile = findExperienceProfile(fitId)
  const suite = findMiniGameSuite(fitId)
  const assetPack = findAssetPack(fitId)

  $('#designFitSelect').innerHTML = fits.map(item => `
    <option value="${escapeAttr(item.fitId)}" ${item.fitId === fitId ? 'selected' : ''}>${escapeHtml(item.title)}</option>
  `).join('')

  $('#designLauncher').innerHTML = `
    <h3>Launcher card</h3>
    <div class="launcher-preview">
      <div class="launcher-skin" style="${skinStyle(profile.serverSkin)}">
        <span class="launcher-badge">${escapeHtml(fit.category)}</span>
      </div>
      <div class="launcher-body">
        <h3>${escapeHtml(fit.title)}</h3>
        <p class="detail-copy">${escapeHtml(profile.visualTone)}</p>
        <div class="chip-row">
          <span>${escapeHtml(fit.entrantShape)} entrants</span>
          <span>${escapeHtml(fit.resultPolicy)}</span>
          <span>${escapeHtml(profile.bracketStyle)}</span>
        </div>
      </div>
    </div>
    <h3>Recommended variants</h3>
    <div class="variant-list">
      ${fit.recommendedVariants.map(variantId => `<span class="variant-chip is-covered">${escapeHtml(variantId)}</span>`).join('')}
    </div>
  `

  $('#designSetup').innerHTML = `
    <h3>Setup wizard panels</h3>
    <div class="setup-panel-list">
      ${profile.customPanels.map((panel, index) => `
        <div class="setup-panel-row">
          <strong>${escapeHtml(panel)}</strong>
          ${pill(`step ${index + 1}`, 'warn')}
        </div>
      `).join('')}
    </div>
    <h3>API adapters</h3>
    <div class="route-list">
      ${profile.apiAdapters.map(adapter => `<span class="route-chip">${escapeHtml(adapter)}</span>`).join('')}
    </div>
  `

  $('#designPickWorkbench').innerHTML = `
    <h3>Pick workbench</h3>
    <p class="detail-copy">Primary picker type for ${escapeHtml(fit.title)}: <strong>${escapeHtml(pickWorkbenchTypeFor(fitId))}</strong>.</p>
    <h3>Pool variants</h3>
    <div class="variant-list">
      ${fit.recommendedVariants.map(variantId => `<span class="variant-chip is-covered">${escapeHtml(variantId)}</span>`).join('')}
    </div>
    <h3>Entrant shape</h3>
    <p class="detail-copy">${escapeHtml(fit.entrantShape)}</p>
  `

  $('#designWatchRoom').innerHTML = `
    <h3>Watch room</h3>
    <p class="detail-copy">Layout mode: <strong>${escapeHtml(profile.layoutMode)}</strong>. Server label: ${escapeHtml(profile.serverLabel)}.</p>
    <h3>Live prompts</h3>
    <div class="style-token-grid">
      ${profile.livePromptLexicon.map(token => `<span>${escapeHtml(token)}</span>`).join('')}
    </div>
    <h3>Custom panels</h3>
    <div class="panel-chip-list">
      ${profile.customPanels.map(panel => `<span class="panel-chip">${escapeHtml(panel)}</span>`).join('')}
    </div>
  `

  $('#designMiniGames').innerHTML = `
    <h3>Mini-game suite</h3>
    <div class="suite-list">
      ${suite.specs.map((spec, index) => `
        <article class="suite-card">
          <div class="route-header">
            <div>
              <h3>${escapeHtml(spec.title)}</h3>
              <span>${escapeHtml(spec.mode)} / ${escapeHtml(spec.commandType)}</span>
            </div>
            ${pill(String(index + 1), 'good')}
          </div>
          <p class="detail-copy">${escapeHtml(spec.headline)}</p>
          <div class="chip-row">
            ${spec.ui.controls.slice(0, 4).map(ctrl => `<span>${escapeHtml(ctrl)}</span>`).join('')}
          </div>
        </article>
      `).join('')}
    </div>
  `

  $('#designResults').innerHTML = `
    <h3>Results & settlement</h3>
    <p class="detail-copy">Result source: <strong>${escapeHtml(fit.resultPolicy)}</strong>. Result review surface: ${escapeHtml(fit.resultPolicy === 'host-entered' ? 'creator' : 'ops')}.</p>
    <h3>Asset pack</h3>
    <div class="detail-list compact">
      <div><span>Theme</span><strong>${escapeHtml(assetPack.themeId)}</strong></div>
      <div><span>Visual tone</span><strong>${escapeHtml(assetPack.visualTone)}</strong></div>
      <div><span>Assets</span><strong>${escapeHtml(assetPack.requiredAssets.length)}</strong></div>
    </div>
    <div class="palette-row">
      ${assetPack.palette.map(color => `<span class="color-swatch" style="background:${swatchColor(color)}" title="${escapeAttr(color)}"></span>`).join('')}
    </div>
  `
}

function pickWorkbenchTypeFor (fitId) {
  const map = {
    'awards-prediction-pools': 'category-card-picker',
    'mma-boxing-fight-card': 'bout-card-picker',
    'march-madness': 'region-bracket-picker',
    'pro-playoffs': 'series-picker',
    'tennis-grand-slams': 'player-draw-picker'
  }
  return map[fitId] || 'bracket-and-card-picker'
}

function renderError (error) {
  document.body.innerHTML = `
    <main class="main">
      <section class="panel">
        <p class="eyebrow">Snapshot error</p>
        <h1>Ultimate Sports preview could not load</h1>
        <p class="live-copy">${escapeHtml(error.message || error)}</p>
      </section>
    </main>
  `
}

function firstFitId (snapshot) {
  return snapshot.catalog && snapshot.catalog.eventFits && snapshot.catalog.eventFits[0] && snapshot.catalog.eventFits[0].fitId
}

function findFit (fitId) {
  return state.snapshot.catalog.eventFits.find(fit => fit.fitId === fitId)
}

function launchRow (fitId) {
  return state.snapshot.launchMatrix.rows.find(row => row.fitId === fitId)
}

function routeForFit (fitId) {
  return state.snapshot.aggregator.routes.find(route => route.fitId === fitId)
}

function smokeCheckFor (sourceId) {
  return state.snapshot.sportsDataSmoke &&
    state.snapshot.sportsDataSmoke.checks &&
    state.snapshot.sportsDataSmoke.checks.find(check => check.sourceId === sourceId)
}

function firstTournamentFitId (snapshot) {
  return snapshot.tournamentShells && snapshot.tournamentShells[0] && snapshot.tournamentShells[0].fitId
}

function firstSurfaceId (snapshot) {
  return snapshot.navigation && snapshot.navigation[0] && snapshot.navigation[0].surfaceId
}

function findTournamentShell (fitId) {
  return state.snapshot.tournamentShells.find(entry => entry.fitId === fitId)
}

function findExperienceProfile (fitId) {
  return state.snapshot.experienceProfiles.find(profile => profile.fitId === fitId)
}

function findMiniGameSuite (fitId) {
  return state.snapshot.miniGameSuites.find(suite => suite.fitId === fitId)
}

function findAssetPack (fitId) {
  return state.snapshot.assetPacks.find(pack => pack.fitId === fitId)
}

function skinStyle (skinId) {
  const gradients = {
    'stadium-flags': 'linear-gradient(135deg, #0f766e, #b98923)',
    'continental-flags': 'linear-gradient(135deg, #15803d, #2563eb)',
    'floodlit-club-night': 'linear-gradient(135deg, #0f172a, #06b6d4)',
    'arena-regions': 'linear-gradient(135deg, #92400e, #1e40af)',
    'series-scoreboard': 'linear-gradient(135deg, #111827, #e5e7eb)',
    'court-draw': 'linear-gradient(135deg, #166534, #b91c1c)',
    'neon-arena': 'linear-gradient(135deg, #111827, #14b8a6, #ec4899)',
    'arena-card': 'linear-gradient(135deg, #18181b, #dc2626, #2563eb)',
    'foiling-race-waterline': 'linear-gradient(135deg, #0c4a6e, #06b6d4)',
    'creator-stage': 'linear-gradient(135deg, #18181b, #d97706, #ec4899)',
    'ceremony-card': 'linear-gradient(135deg, #18181b, #b98923)',
    'community-scoreboard': 'linear-gradient(135deg, #3f6212, #f97316)',
    'catalog-lobby': 'linear-gradient(135deg, #202124, #0f766e)'
  }
  return `background:${gradients[skinId] || gradients['catalog-lobby']};`
}

function swatchColor (colorToken) {
  const map = {
    'pitch-green': '#15803d',
    'trophy-gold': '#b98923',
    'signal-red': '#dc2626',
    'night-navy': '#1e3a8a',
    'grass-green': '#16a34a',
    'sunlit-blue': '#3b82f6',
    'cup-silver': '#94a3b8',
    'alert-red': '#ef4444',
    'midnight': '#0f172a',
    'electric-cyan': '#06b6d4',
    'silver': '#cbd5e1',
    'hardwood': '#92400e',
    'court-blue': '#1d4ed8',
    'rim-orange': '#f97316',
    'chalk-white': '#f8fafc',
    'scoreboard-black': '#111827',
    'ice-white': '#f9fafb',
    'basepath-clay': '#c2410c',
    'court-green': '#166534',
    'clay-red': '#b91c1c',
    'line-white': '#f8fafc',
    'champion-gold': '#d97706',
    'obsidian': '#0f172a',
    'neon-teal': '#14b8a6',
    'hot-pink': '#ec4899',
    'hud-green': '#22c55e',
    'matte-black': '#18181b',
    'canvas-white': '#f8fafc',
    'corner-red': '#dc2626',
    'corner-blue': '#2563eb',
    'championship-gold': '#d97706',
    'deep-water-blue': '#0c4a6e',
    'wake-white': '#f0f9ff',
    'wind-cyan': '#06b6d4',
    'buoy-orange': '#f97316',
    'carbon-black': '#111827',
    'studio-black': '#18181b',
    'spotlight-gold': '#d97706',
    'creator-pink': '#ec4899',
    'paper-white': '#f8fafc',
    'velvet-black': '#18181b',
    'award-gold': '#d97706',
    'stage-red': '#dc2626',
    'spotlight-white': '#ffffff',
    'chalkboard': '#3f3f46',
    'rec-green': '#16a34a',
    'signal-orange': '#f97316',
    'lobby-charcoal': '#202124',
    'field-green': '#15803d',
    'scoreboard-white': '#f8fafc',
    'action-gold': '#d97706'
  }
  return map[colorToken] || colorToken
}

function serverCard (server, active) {
  const liveBadge = active
    ? pill('live', 'good')
    : pill(server.status === 'live' ? 'live' : 'host', server.status === 'live' ? 'good' : 'warn')
  return `
    <article class="server-card ${server.status === 'live' ? 'is-live' : ''}" type="button" data-join-fit="${escapeAttr(server.fitId)}">
      <div class="server-skin" style="${skinStyle(server.serverSkin)}">
        <span class="server-category">${escapeHtml(server.category)}</span>
        ${liveBadge}
      </div>
      <div class="server-card-body">
        <h3>${escapeHtml(server.title)}</h3>
        <p class="detail-copy">${escapeHtml(server.serverLabel)}</p>
        <div class="mini-stats">
          <span>${escapeHtml(server.playerCount)} online</span>
          <span>${escapeHtml(server.roomCount)} rooms</span>
          <span>${escapeHtml(server.recommendedVariantCount || 0)} variants</span>
          <span>${escapeHtml(server.recommendedMiniGameCount || 0)} games</span>
        </div>
      </div>
      <button type="button" class="join-button" data-join-fit="${escapeAttr(server.fitId)}">Join server</button>
    </article>
  `
}

function joinServer (fitId) {
  state.selectedServerFitId = fitId
  state.selectedServerTab = 'games'
  setSurface('server')
  renderServer()
  showToast(`Joined ${findFit(fitId)?.title || fitId} server`)
}

function bindBackButton () {
  $$('#serverHeader [data-surface]').forEach(button => {
    button.addEventListener('click', () => setSurface(button.dataset.surface))
  })
}

function totalOnlinePlayers (liveServers) {
  return Object.values(liveServers).reduce((sum, server) => sum + (server.playerCount || 0), 0)
}

function firstActiveServerFitId (snapshot) {
  const liveServers = snapshot.liveServers || {}
  const live = Object.values(liveServers).find(server => server.status === 'live')
  return live ? live.fitId : (snapshot.catalog.eventFits[0] && snapshot.catalog.eventFits[0].fitId)
}

function capitalize (value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1)
}

function readout (label, value) {
  return `
    <div class="readout-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `
}

function pill (label, tone = '') {
  const className = tone ? ` is-${tone}` : ''
  return `<span class="pill${className}">${escapeHtml(label)}</span>`
}

function boundPercent (value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, number))
}

function formatDate (value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function showToast (message) {
  const toast = $('#toast')
  if (!toast) return
  toast.textContent = message
  toast.classList.add('is-visible')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200)
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
