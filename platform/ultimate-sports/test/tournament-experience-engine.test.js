'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const { catalog, platform, tournamentExperience } = require('../src')

const planDocPath = path.join(__dirname, '..', 'docs', 'tournament-lobby-asset-plan.md')
const planDoc = fs.readFileSync(planDocPath, 'utf8')

test('tournament lobby shows catalog browser when no tournament server is active', () => {
  const lobby = tournamentExperience.createTournamentLobby()
  const fitCount = catalog.listEventFits().length

  assert.equal(lobby.state, 'empty')
  assert.equal(lobby.activeServerCount, 0)
  assert.equal(lobby.activeServers.length, 0)
  assert.equal(lobby.catalogServers.length, fitCount)
  assert.equal(lobby.selectedExperience, null)
  assert.equal(lobby.emptyState.primaryAction, 'browse-catalog')
  assert.ok(lobby.filters.some(filter => filter.category === 'soccer'))
})

test('tournament lobby selects one custom GUI bundle across multiple active sports', () => {
  const lobby = tournamentExperience.createTournamentLobby({
    selectedFitId: 'march-madness',
    activeTournaments: [
      { tournamentId: 'wc-2030', fitId: 'world-cup', title: 'World Cup 2030', status: 'live', playerCount: 128, roomCount: 12 },
      { tournamentId: 'march-2027', fitId: 'march-madness', title: 'March 2027', status: 'live', playerCount: 64, roomCount: 8 },
      { tournamentId: 'oscars-2027', fitId: 'awards-prediction-pools', title: 'Oscars Pool', status: 'scheduled', playerCount: 22, roomCount: 2 }
    ]
  })

  assert.equal(lobby.state, 'active')
  assert.equal(lobby.activeServerCount, 3)
  assert.deepEqual(
    new Set(lobby.activeServers.map(server => server.category)),
    new Set(['soccer', 'basketball', 'awards'])
  )
  assert.equal(lobby.selectedExperience.fitId, 'march-madness')
  assert.equal(lobby.selectedExperience.gui.shellId, 'large-basketball-bracket-shell')
  assert.equal(lobby.selectedExperience.competition.bracketStyle, 'seeded-region-bracket')
  assert.equal(lobby.selectedExperience.apiPlan.adapters.includes('seed-lines'), true)
  assert.equal(lobby.selectedExperience.assetPack.requiredAssets.length, tournamentExperience.REQUIRED_ASSET_TYPES.length)
})

test('tournament shell turns selected server into renderable routes, slots, dock, and asset queue', () => {
  const shellState = tournamentExperience.createTournamentShell({
    selectedTournamentId: 'march-2027',
    activeTournaments: [
      { tournamentId: 'wc-2030', fitId: 'world-cup', title: 'World Cup 2030', status: 'live', playerCount: 128, roomCount: 12 },
      { tournamentId: 'march-2027', fitId: 'march-madness', title: 'March 2027', status: 'live', playerCount: 64, roomCount: 8 }
    ]
  })
  const shell = shellState.shell

  assert.equal(shellState.selectedExperience.fitId, 'march-madness')
  assert.equal(shell.shellId, 'large-basketball-bracket-shell')
  assert.equal(shell.route, '/tournaments/march-2027')
  assert.equal(shell.serverRail.filter(server => server.mode === 'active').length, 2)
  assert.equal(shell.serverRail.some(server => server.selected && server.tournamentId === 'march-2027'), true)
  assert.deepEqual(
    new Set(shell.routeMap.map(route => route.surfaceId)),
    new Set(['lobby', 'overview', 'picks', 'pools', 'watch', 'games', 'results', 'wallet'])
  )
  assert.equal(shell.screenSlots.some(slot => slot.slotId === 'watch-room' && slot.bindings.includes('miniGameDock')), true)
  assert.equal(shell.poolTabs.some(tab => tab.variantId === 'upset-bounty'), true)
  assert.equal(shell.miniGameDock.some(item => item.gameType === 'peer-mini-fantasy'), true)
  assert.equal(shell.apiConnections.some(connection => connection.adapterId === 'seed-lines'), true)
  assert.equal(shell.assetQueue.length, tournamentExperience.REQUIRED_ASSET_TYPES.length)
  assert.equal(shell.assetQueue.every(asset => asset.bindingTarget && asset.prompt && asset.acceptance), true)
})

test('tournament shell handles empty lobby and catalog template preview states', () => {
  const emptyShell = tournamentExperience.createTournamentShell()
  const previewShell = tournamentExperience.createTournamentShell({ selectedFitId: 'awards-prediction-pools' })

  assert.equal(emptyShell.lobby.state, 'empty')
  assert.equal(emptyShell.selectedExperience, null)
  assert.equal(emptyShell.shell.shellId, 'tournament-lobby-empty-shell')
  assert.equal(emptyShell.shell.header.primaryAction, 'browse-catalog')
  assert.equal(previewShell.lobby.state, 'empty')
  assert.equal(previewShell.selectedExperience.fitId, 'awards-prediction-pools')
  assert.equal(previewShell.shell.shellId, 'awards-card-shell')
  assert.equal(previewShell.shell.header.primaryAction, 'create-tournament')
  assert.equal(previewShell.shell.screenSlots.some(slot => slot.component === 'category-card-picker'), true)
})

test('every catalog fit has a managed GUI, API plan, pools, mini-games, and assets', () => {
  catalog.listEventFits().forEach(fit => {
    const experience = tournamentExperience.createTournamentExperience({ fitId: fit.fitId })
    const shellState = tournamentExperience.createTournamentShell({ selectedFitId: fit.fitId })
    const assetTypes = new Set(experience.assetPack.requiredAssets.map(asset => asset.assetType))

    assert.equal(experience.gui.shellId.length > 0, true, `${fit.fitId} missing shell`)
    assert.equal(experience.gui.customPanels.length > 0, true, `${fit.fitId} missing custom panels`)
    assert.deepEqual(experience.competition.templateKinds, fit.templateKinds)
    assert.deepEqual(experience.competition.poolVariants, fit.recommendedVariants)
    assert.deepEqual(experience.miniGameDock.gameTypes, fit.recommendedMiniGames)
    assert.equal(experience.apiPlan.adapters.length > 0, true, `${fit.fitId} missing API adapters`)
    assert.equal(experience.management.route, `/tournaments/${fit.fitId}`)
    assert.equal(shellState.shell.poolTabs.length, fit.recommendedVariants.length)
    assert.equal(shellState.shell.miniGameDock.length, fit.recommendedMiniGames.length)
    assert.equal(shellState.shell.apiConnections.length, experience.apiPlan.adapters.length)
    tournamentExperience.REQUIRED_ASSET_TYPES.forEach(assetType => {
      assert.equal(assetTypes.has(assetType), true, `${fit.fitId} missing ${assetType}`)
      assert.equal(shellState.shell.assetQueue.some(asset => asset.assetType === assetType), true, `${fit.fitId} shell missing ${assetType}`)
    })
  })
})

test('asset generation plan covers all fits and separates generated from licensed assets', () => {
  const allPlan = tournamentExperience.createAssetGenerationPlan()
  const singlePlan = tournamentExperience.createAssetGenerationPlan({ fitId: 'local-leagues' })

  assert.equal(allPlan.packs.length, catalog.listEventFits().length)
  assert.equal(singlePlan.packs.length, 1)
  assert.equal(singlePlan.packs[0].fitId, 'local-leagues')
  assert.match(allPlan.sourcePolicy.generated, /non-branded art/)
  assert.match(allPlan.sourcePolicy.licensed, /official logos/)
  assert.equal(allPlan.pipeline.includes('bind-assets-to-gui-shell'), true)
})

test('facade exposes tournament lobby and asset plan helpers', () => {
  const app = platform.createUltimateSportsPlatform()
  const lobby = app.createTournamentLobby({
    activeTournaments: [{ tournamentId: 'local-cup', fitId: 'local-leagues', status: 'live' }]
  })
  const shellState = app.createTournamentShell({
    activeTournaments: [{ tournamentId: 'local-cup', fitId: 'local-leagues', status: 'live' }]
  })
  const assetPlan = app.createAssetGenerationPlan({ fitId: 'local-leagues' })

  assert.equal(lobby.selectedExperience.fitId, 'local-leagues')
  assert.equal(lobby.selectedExperience.gui.shellId, 'local-flex-league-shell')
  assert.equal(shellState.shell.shellId, 'local-flex-league-shell')
  assert.equal(shellState.shell.assetQueue.some(asset => asset.sourceType === 'host-upload-or-generated'), true)
  assert.equal(assetPlan.packs[0].fitId, 'local-leagues')
})

test('tournament lobby and asset plan doc names every managed event fit', () => {
  catalog.listEventFits().forEach(fit => {
    assert.equal(planDoc.includes(`### \`${fit.fitId}\``), true, `${fit.fitId} missing from lobby asset plan`)
  })
  ;['createTournamentLobby', 'createTournamentExperience', 'createTournamentShell', 'createAssetGenerationPlan'].forEach(methodName => {
    assert.equal(planDoc.includes(methodName), true, `${methodName} missing from implementation contract`)
  })
  tournamentExperience.REQUIRED_ASSET_TYPES.forEach(assetType => {
    assert.equal(planDoc.includes(`\`${assetType}\``), true, `${assetType} missing from asset plan doc`)
  })
})
