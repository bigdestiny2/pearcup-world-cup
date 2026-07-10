const assert = require('node:assert/strict')
const test = require('node:test')

require('./core.js')
const qvac = require('./qvac-referee.js')

test('QVAC trivia fallback selects reviewed World Cup history for the active fixture', () => {
  const input = {
    matchId: 'fixture-42',
    language: 'EN',
    match: {
      home: { name: 'Spain', goals: 1 },
      away: { name: 'Belgium', goals: 0 },
      stage: 'QUARTER_FINALS'
    }
  }
  const fallback = qvac.triviaFallbackRound({ ...input, roundOrdinal: 0 })
  const round = qvac.createTriviaRound({ input, ...fallback, hostId: 'qvac-test' })

  assert.match(round.question, /Spain/)
  assert.ok(round.options.includes('2010') || round.options.includes('Netherlands'))
  assert.ok(Number.isInteger(round.answerIndex))
  assert.equal(round.category, 'Team World Cup history')
  assert.equal(round.matchId, 'fixture-42')
  assert.ok(round.triviaId)
})

test('QVAC trivia alternates fixture history with general football knowledge', () => {
  const base = {
    matchId: 'fixture-rotation',
    match: { home: { name: 'Spain' }, away: { name: 'Belgium' } }
  }

  assert.ok(qvac.triviaCandidates({ ...base, roundOrdinal: 0 })[0].id.startsWith('spain-'))
  assert.ok(qvac.triviaCandidates({ ...base, roundOrdinal: 1 })[0].id.startsWith('belgium-'))
  assert.ok(qvac.triviaCandidates({ ...base, roundOrdinal: 3 })[0].id.startsWith('general-'))
})

test('QVAC trivia adapter normalizes model output into a four-option room round', async () => {
  const client = {
    async completeJson ({ history }) {
      assert.match(history[0].content, /watch-party trivia host/)
      const prompt = JSON.parse(history[1].content)
      assert.equal(prompt.task, 'select_verified_world_cup_watch_party_trivia')
      assert.ok(prompt.candidates.some(candidate => candidate.id === 'spain-2010-first-title'))
      return JSON.stringify({
        questionId: 'spain-2010-first-title'
      })
    }
  }
  const adapter = qvac.createQvacCompletionCommentaryAdapter({ client, modelId: 'qvac-test-model' })
  const round = await adapter.generateTriviaRound({
    matchId: 'fixture-7',
    language: 'EN',
    match: { home: { name: 'Spain' }, away: { name: 'Belgium' } }
  })

  assert.equal(round.question, 'In which year did Spain win its first men’s World Cup?')
  assert.deepEqual(round.options, ['1982', '1994', '2006', '2010'])
  assert.equal(round.answerIndex, 3)
  assert.equal(round.questionId, 'spain-2010-first-title')
  assert.equal(round.modelId, 'qvac-test-model')
})
