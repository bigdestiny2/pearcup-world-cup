const assert = require('node:assert/strict')
const test = require('node:test')

require('./core.js')
const qvac = require('./qvac-referee.js')

test('QVAC trivia fallback remains answerable from the active match snapshot', () => {
  const input = {
    matchId: 'fixture-42',
    language: 'EN',
    match: {
      home: { name: 'Spain', goals: 1 },
      away: { name: 'Belgium', goals: 0 },
      stage: 'QUARTER_FINALS'
    }
  }
  const fallback = qvac.triviaFallbackRound(input)
  const round = qvac.createTriviaRound({ input, ...fallback, hostId: 'qvac-test' })

  assert.equal(round.question, 'Which team is listed first for Spain vs Belgium?')
  assert.deepEqual(round.options, ['Spain', 'Belgium', 'Winner of quarter finals', 'No team is listed'])
  assert.equal(round.answerIndex, 0)
  assert.equal(round.matchId, 'fixture-42')
  assert.ok(round.triviaId)
})

test('QVAC trivia adapter normalizes model output into a four-option room round', async () => {
  const client = {
    async completeJson ({ history }) {
      assert.match(history[0].content, /watch-party trivia host/)
      return JSON.stringify({
        question: 'Which side is the home team?',
        options: ['Spain', 'Belgium', 'Draw', 'TBD'],
        answerIndex: 0,
        explanation: 'Spain is shown as the home team in the supplied match snapshot.'
      })
    }
  }
  const adapter = qvac.createQvacCompletionCommentaryAdapter({ client, modelId: 'qvac-test-model' })
  const round = await adapter.generateTriviaRound({
    matchId: 'fixture-7',
    language: 'EN',
    match: { home: { name: 'Spain' }, away: { name: 'Belgium' } }
  })

  assert.equal(round.question, 'Which side is the home team?')
  assert.deepEqual(round.options, ['Spain', 'Belgium', 'Draw', 'TBD'])
  assert.equal(round.answerIndex, 0)
  assert.equal(round.modelId, 'qvac-test-model')
})
