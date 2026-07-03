'use strict'

const { assertNonEmptyString, cloneJson, hash32, stableId } = require('./util')

const CARD_TYPES = Object.freeze([
  'group-stage-card',
  'awards-card',
  'fight-card',
  'player-prop-card',
  'watch-party-bingo'
])

const FIELD_TYPES = Object.freeze([
  'single-choice',
  'ordered-choice',
  'numeric-total',
  'range',
  'free-text',
  'bingo-cell'
])

function createPredictionCard (input = {}) {
  assertNonEmptyString(input.competitionId, 'competitionId')
  const cardType = input.cardType || 'group-stage-card'
  if (!CARD_TYPES.includes(cardType)) throw new RangeError(`cardType must be one of: ${CARD_TYPES.join(', ')}`)
  const fields = (input.fields || []).map(normalizeField)
  const scoringConfig = cloneJson(input.scoringConfig || {})
  if (cardType === 'watch-party-bingo' && scoringConfig.lineBonus == null) scoringConfig.lineBonus = 2
  return {
    cardId: input.cardId || stableId(`card-${cardType}`, {
      competitionId: input.competitionId,
      fields: fields.map(field => field.fieldId)
    }),
    competitionId: input.competitionId,
    cardType,
    title: input.title || cardType,
    fields,
    scoringConfig,
    lockPolicy: input.lockPolicy || 'event-lock'
  }
}

function normalizeField (field, index) {
  if (!field || typeof field !== 'object') throw new TypeError('field must be an object')
  assertNonEmptyString(field.label || field.fieldId, 'field label')
  const fieldType = field.fieldType || 'single-choice'
  if (!FIELD_TYPES.includes(fieldType)) throw new RangeError(`fieldType must be one of: ${FIELD_TYPES.join(', ')}`)
  return {
    fieldId: field.fieldId || stableId(`field-${fieldType}-${index + 1}`, field.label),
    fieldType,
    label: field.label || field.fieldId,
    options: cloneJson(field.options || []),
    weight: Number(field.weight || 1),
    tolerance: Number(field.tolerance || 0),
    required: field.required !== false,
    metadata: normalizeFieldMetadata(field)
  }
}

function validateCardSubmission ({ card, answers = {} } = {}) {
  if (!card || typeof card !== 'object') throw new TypeError('card is required')
  const errors = []
  card.fields.forEach(field => {
    const answer = answers[field.fieldId]
    if (field.required && answer == null) errors.push(`${field.fieldId} is required`)
    if (answer != null && field.options.length && (field.fieldType === 'single-choice' || field.fieldType === 'bingo-cell')) {
      if (!field.options.includes(answer)) errors.push(`${field.fieldId} has an invalid option`)
    }
  })
  return {
    ok: errors.length === 0,
    errors
  }
}

function createCardSubmission ({ card, userId, answers, submittedAt = new Date().toISOString() } = {}) {
  if (!card || typeof card !== 'object') throw new TypeError('card is required')
  assertNonEmptyString(userId, 'userId')
  const validation = validateCardSubmission({ card, answers })
  if (!validation.ok) throw new Error(`invalid card submission: ${validation.errors.join('; ')}`)
  return {
    submissionId: stableId(`card-submission-${card.cardId}-${userId}`, {
      cardId: card.cardId,
      userId,
      answers
    }),
    cardId: card.cardId,
    competitionId: card.competitionId,
    userId,
    answers: cloneJson(answers),
    submittedAt,
    status: 'submitted'
  }
}

function scorePredictionCard ({ card, submission, results = {} } = {}) {
  if (!card || typeof card !== 'object') throw new TypeError('card is required')
  const answers = submission && submission.answers || {}
  const detail = card.fields.map(field => {
    const answer = answers[field.fieldId]
    const actual = results[field.fieldId]
    const correct = scoreFieldCorrect(field, answer, actual)
    return {
      fieldId: field.fieldId,
      fieldType: field.fieldType,
      picked: cloneJson(answer),
      actual: cloneJson(actual),
      weight: field.weight,
      correct,
      points: correct ? field.weight : 0
    }
  })
  const bingo = card.cardType === 'watch-party-bingo'
    ? scoreBingoLines({ card, detail })
    : null
  const fieldScore = detail.reduce((sum, row) => sum + row.points, 0)
  const fieldPossibleScore = detail.reduce((sum, row) => sum + row.weight, 0)
  return {
    cardId: card.cardId,
    submissionId: submission && submission.submissionId,
    userId: submission && submission.userId,
    score: fieldScore + (bingo ? bingo.lineBonusPoints : 0),
    possibleScore: fieldPossibleScore + (bingo ? bingo.possibleLineBonusPoints : 0),
    correctCount: detail.filter(row => row.correct).length,
    bingo,
    detail
  }
}

function resolvePredictionCard ({ card, submissions = [], results = {}, resolvedAt = new Date().toISOString() } = {}) {
  if (!card || typeof card !== 'object') throw new TypeError('card is required')
  const rows = submissions
    .filter(submission => submission && submission.cardId === card.cardId)
    .map(submission => scorePredictionCard({ card, submission, results }))
    .sort(scoreRowSort)
  const winningScore = rows.length ? rows[0].score : 0
  const winnerRows = rows.filter(row => row.score === winningScore)
  const body = {
    cardId: card.cardId,
    results: cloneJson(results),
    rows,
    winnerUserIds: winnerRows.map(row => row.userId).filter(Boolean)
  }

  return {
    resolutionId: stableId(`card-resolution-${card.cardId}`, body),
    cardId: card.cardId,
    competitionId: card.competitionId,
    results: cloneJson(results),
    rows,
    winnerUserIds: body.winnerUserIds,
    winningScore,
    tied: winnerRows.length > 1,
    resultHash: hash32(body),
    resolvedAt
  }
}

function scoreFieldCorrect (field, answer, actual) {
  if (actual == null) return false
  if (field.fieldType === 'ordered-choice') {
    return Array.isArray(answer) && Array.isArray(actual) &&
      answer.length === actual.length &&
      answer.every((value, index) => value === actual[index])
  }
  if (field.fieldType === 'numeric-total') {
    return Number.isFinite(Number(answer)) &&
      Math.abs(Number(answer) - Number(actual)) <= Number(field.tolerance || 0)
  }
  if (field.fieldType === 'range') {
    return actual >= answer.min && actual <= answer.max
  }
  if (field.fieldType === 'free-text') {
    return String(answer || '').trim().toLowerCase() === String(actual || '').trim().toLowerCase()
  }
  return answer === actual
}

function normalizeFieldMetadata (field) {
  const metadata = cloneJson(field.metadata || {})
  ;['row', 'col', 'rowIndex', 'columnIndex'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(field, key) && !Object.prototype.hasOwnProperty.call(metadata, key)) {
      metadata[key] = field[key]
    }
  })
  return metadata
}

function scoreBingoLines ({ card, detail }) {
  const lineBonus = Number(card.scoringConfig && card.scoringConfig.lineBonus || 0)
  const positions = card.fields.map(field => {
    const row = positionValue(field.metadata && (field.metadata.row ?? field.metadata.rowIndex))
    const col = positionValue(field.metadata && (field.metadata.col ?? field.metadata.columnIndex))
    if (row == null || col == null) return null
    const rowDetail = detail.find(item => item.fieldId === field.fieldId)
    return {
      fieldId: field.fieldId,
      row,
      col,
      correct: Boolean(rowDetail && rowDetail.correct)
    }
  }).filter(Boolean)

  if (positions.length === 0) {
    return {
      lineBonus,
      completedLines: [],
      lineBonusPoints: 0,
      possibleLines: [],
      possibleLineBonusPoints: 0
    }
  }

  const rows = uniqueNumbers(positions.map(position => position.row))
  const cols = uniqueNumbers(positions.map(position => position.col))
  const cells = new Map(positions.map(position => [`${position.row}:${position.col}`, position]))
  const possibleLines = []
  rows.forEach(row => {
    const lineCells = cols.map(col => cells.get(`${row}:${col}`))
    if (lineCells.every(Boolean)) possibleLines.push(bingoLine('row', row, lineCells))
  })
  cols.forEach(col => {
    const lineCells = rows.map(row => cells.get(`${row}:${col}`))
    if (lineCells.every(Boolean)) possibleLines.push(bingoLine('column', col, lineCells))
  })
  if (rows.length === cols.length) {
    const diagonalDown = rows.map((row, index) => cells.get(`${row}:${cols[index]}`))
    const diagonalUp = rows.map((row, index) => cells.get(`${row}:${cols[cols.length - index - 1]}`))
    if (diagonalDown.every(Boolean)) possibleLines.push(bingoLine('diagonal', 0, diagonalDown))
    if (diagonalUp.every(Boolean)) possibleLines.push(bingoLine('diagonal', 1, diagonalUp))
  }
  const completedLines = possibleLines.filter(line => line.fieldIds.every(fieldId => {
    const cell = positions.find(position => position.fieldId === fieldId)
    return cell && cell.correct
  }))

  return {
    lineBonus,
    completedLines,
    lineBonusPoints: completedLines.length * lineBonus,
    possibleLines,
    possibleLineBonusPoints: possibleLines.length * lineBonus
  }
}

function positionValue (value) {
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

function uniqueNumbers (values) {
  return [...new Set(values)].sort((left, right) => left - right)
}

function bingoLine (lineType, index, cells) {
  return {
    lineId: `${lineType}:${index}`,
    lineType,
    index,
    fieldIds: cells.map(cell => cell.fieldId)
  }
}

function scoreRowSort (left, right) {
  if (right.score !== left.score) return right.score - left.score
  if (right.correctCount !== left.correctCount) return right.correctCount - left.correctCount
  return String(left.userId || '').localeCompare(String(right.userId || ''))
}

module.exports = {
  CARD_TYPES,
  FIELD_TYPES,
  createPredictionCard,
  validateCardSubmission,
  createCardSubmission,
  scorePredictionCard,
  resolvePredictionCard,
  scoreFieldCorrect,
  scoreBingoLines,
  scoreRowSort
}
