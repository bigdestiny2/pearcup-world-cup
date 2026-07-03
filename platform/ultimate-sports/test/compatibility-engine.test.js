'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { compatibility, runtime } = require('../src')

const teams = [
  { id: 'br', name: 'Brazil', flag: 'BR' },
  { id: 'jp', name: 'Japan', flag: 'JP' },
  { id: 'no', name: 'Norway', flag: 'NO' },
  { id: 'ci', name: 'Ivory Coast', flag: 'CI' }
]

const round32Matches = [
  { id: 'r32-1', time: 'Sat, 06/28', status: 'FT', slots: ['br', 'jp'], score: [2, 1] },
  { id: 'r32-2', time: 'Sun, 06/29', status: 'FT', slots: ['no', 'ci'], score: [1, 0] }
]

const bracketMatchIds = ['r32-1', 'r32-2', 'final-1']
const bracketLinks = [{ from: ['r32-1', 'r32-2'], to: 'final-1' }]

test('World Cup compatibility plan maps v1 app state into replayable v2 commands', () => {
  const plan = compatibility.createWorldCupCompatibilityPlan({
    competitionId: 'compat-cup',
    title: 'Compatibility Cup',
    teams,
    round32Matches,
    bracketMatchIds,
    bracketLinks,
    pools: [{ tier: 25, max: 160, prize: '$2,050', rail: 'USDT demo' }],
    state: {
      username: 'captain',
      submittedPicksByTier: {
        25: {
          'r32-1': 'br',
          'r32-2': 'no',
          'final-1': 'br'
        }
      }
    },
    officialResults: {
      matchWinners: {
        'r32-1': 'br',
        'r32-2': 'no',
        'final-1': 'br'
      },
      source: 'pearcup-demo-match-feed',
      capturedAt: '2026-07-03T19:00:00.000Z'
    }
  })
  const app = runtime.createPlatformRuntime()
  plan.commands.forEach(command => app.dispatch(command))
  const view = app.view()

  assert.equal(plan.competition.fixtures.length, 3)
  assert.equal(plan.pools[0].poolId, 'world-cup-25')
  assert.equal(plan.submissions[0].userId, 'user-captain')
  assert.equal(plan.resultSnapshot.results['final-1'].roundNumber, 5)
  assert.equal(plan.commands.some(command => command.type === 'pool:resolve'), true)
  assert.equal(view.competitions['compat-cup'].entrantIds.length, 4)
  assert.equal(view.predictionEntries['world-cup-25-user-captain'].status, 'locked')
  assert.deepEqual(view.poolSettlements['world-cup-25'].winnerUserIds, ['user-captain'])
})

test('compatibility adapter extracts worker-view submissions and official snapshots', () => {
  const plan = compatibility.createWorldCupCompatibilityPlan({
    competitionId: 'worker-compat-cup',
    teams,
    round32Matches,
    bracketMatchIds,
    bracketLinks,
    pools: [{ tier: 25 }],
    workerView: {
      bracketSubmissionsByPool: {
        'world-cup-25': {
          'user-lina': {
            submissionId: 'submission-lina',
            poolId: 'world-cup-25',
            entryId: 'entry-lina',
            userId: 'user-lina',
            username: 'lina',
            picks: {
              'r32-1': 'br',
              'r32-2': 'ci',
              'final-1': 'br'
            },
            rulesVersion: 'bracket-pool-v1'
          }
        }
      },
      officialResultsSnapshots: {
        'world-cup-25': {
          poolId: 'world-cup-25',
          officialResults: {
            matchWinners: {
              'r32-1': 'br',
              'r32-2': 'no',
              'final-1': 'br'
            },
            source: 'trusted-results-feed'
          }
        }
      }
    }
  })
  const app = runtime.createPlatformRuntime()
  plan.commands.forEach(command => app.dispatch(command))
  const settlement = app.view().poolSettlements['world-cup-25']

  assert.equal(plan.submissions[0].sourceSubmissionId, 'submission-lina')
  assert.equal(plan.resultSnapshot.sourceId, 'trusted-results-feed')
  assert.equal(settlement.leaderboard[0].userId, 'user-lina')
  assert.equal(settlement.leaderboard[0].score, 17)
})

test('compatibility adapter drops unknown match and entrant picks with warnings', () => {
  const warnings = []
  const picks = compatibility.normalizeWorldCupPicks({
    'r32-1': 'br',
    'r32-404': 'br',
    'r32-2': 'zz'
  }, {
    matchIds: bracketMatchIds,
    entrantIds: new Set(teams.map(team => team.id)),
    warnings
  })

  assert.deepEqual(picks, { 'r32-1': 'br' })
  assert.equal(warnings.some(message => message.includes('unknown World Cup match')), true)
  assert.equal(warnings.some(message => message.includes('unknown World Cup entrant')), true)
  assert.equal(compatibility.roundNameForWorldCupMatch('qf-2'), 'Quarterfinals')
  assert.equal(compatibility.worldCupPoolIdForTier(100), 'world-cup-100')
})
