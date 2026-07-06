#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createUltimateSportsPlatform } = require('../src/platform')

const OUTPUT_NAME = 'servers.json'

function generateLobbyServers (input = {}) {
  const rootDir = input.rootDir || path.resolve(__dirname, '..')
  const outDir = input.outDir || path.join(rootDir, 'lobby-app', 'data')
  const outFile = input.outFile || path.join(outDir, OUTPUT_NAME)
  const app = createUltimateSportsPlatform({ peerId: 'lobby' })
  const catalog = app.catalog()
  const lobby = app.createTournamentLobby({})

  const activeFitIds = new Set(lobby.activeServers.map(server => server.fitId))
  const featuredFitId = input.featuredFitId || 'world-cup'

  const servers = catalog.eventFits.map((fit, index) => {
    const isLive = activeFitIds.has(fit.fitId) || liveFitIds().includes(fit.fitId)
    const isFeatured = fit.fitId === featuredFitId
    const coverUrl = coverForFit(fit.fitId)
    const appUrl = appUrlForFit(fit.fitId)
    return {
      serverId: `server:${fit.fitId}`,
      fitId: fit.fitId,
      title: fit.title,
      category: fit.category,
      entrantShape: fit.entrantShape,
      resultPolicy: fit.resultPolicy,
      recommendedVariantCount: fit.recommendedVariants.length,
      recommendedMiniGameCount: fit.recommendedMiniGames.length,
      isLive,
      isFeatured,
      tagline: taglineForFit(fit.fitId),
      coverUrl,
      appUrl
    }
  })

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outFile, `${JSON.stringify(servers, null, 2)}\n`)
  return { outFile, servers }
}

function liveFitIds () {
  return ['world-cup', 'euros-copa-america', 'march-madness', 'mma-boxing-fight-card', 'sailgp-companion']
}

function taglineForFit (fitId) {
  const map = {
    'world-cup': 'Global group-stage and knockout bracket pools.',
    'euros-copa-america': 'Regional international cup watch parties.',
    'champions-league-knockout': 'Premium club knockout duels.',
    'march-madness': 'Large bracket night with upset bounties.',
    'pro-playoffs': 'NBA, NHL, MLB series playoffs.',
    'tennis-grand-slams': 'Grand slam draw and set-score games.',
    'esports-major': 'Map, objective, and clutch esports games.',
    'mma-boxing-fight-card': 'Fight-night cards, methods, and rounds.',
    'sailgp-companion': 'Fleet-race companion and foiling props.',
    'creator-reality-brackets': 'Creator and reality show brackets.',
    'awards-prediction-pools': 'Oscars, Grammys, and ceremony-night cards.',
    'local-leagues': 'School, office, pub, and rec sports.'
  }
  return map[fitId] || 'Join the tournament server.'
}

function coverForFit (fitId) {
  if (fitId === 'mma-boxing-fight-card') {
    return '../generated/mma-card/server-card-cover/desktop-cover.png'
  }
  return '../generated/fit-covers/' + fitId + '.svg'
}

function appUrlForFit (fitId) {
  if (fitId === 'world-cup') return '/shell/index.html?fit=world-cup'
  if (fitId === 'mma-boxing-fight-card') return '/shell/index.html?fit=mma-boxing-fight-card'
  return '/shell/index.html?fit=' + encodeURIComponent(fitId)
}

function parseArgs (argv = process.argv.slice(2)) {
  const parsed = {}
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--out-dir') parsed.outDir = argv[++index]
    else if (arg === '--out-file') parsed.outFile = argv[++index]
    else if (arg === '--featured') parsed.featuredFitId = argv[++index]
  }
  return parsed
}

if (require.main === module) {
  const result = generateLobbyServers(parseArgs())
  console.log(`Lobby servers: ${result.outFile}`)
  console.log(`Servers: ${result.servers.length} (${result.servers.filter(s => s.isLive).length} live)`)
}

module.exports = {
  generateLobbyServers,
  OUTPUT_NAME,
  parseArgs
}
