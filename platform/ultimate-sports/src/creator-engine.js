'use strict'

const {
  createCompetitionTemplate,
  defaultRoundName,
  fixtureIdFor,
  isPowerOfTwo,
  normalizeEntrants
} = require('./competition-engine')
const { createHostResultCorrection, createResultSnapshot } = require('./feed-engine')
const { assertNonEmptyString, cloneJson, slugify, stableId } = require('./util')

const DEFAULT_CREATOR_VARIANTS = Object.freeze([
  'classic-bracket',
  'confidence',
  'watch-party-bingo',
  'side-quest'
])

const DEFAULT_CREATOR_LAUNCH_AT = '2026-07-03T00:00:00.000Z'

function createCreatorCompetitionDraft (input = {}) {
  assertNonEmptyString(input.title, 'title')
  assertNonEmptyString(input.organizerId, 'organizerId')

  const template = createCompetitionTemplate({
    kind: input.kind || 'creator-custom',
    sportOrCategory: input.sportOrCategory || 'creator',
    entrantShape: input.entrantShape || 'custom',
    resultPolicy: input.resultPolicy || 'host-entered',
    supportsOfficialFeed: false,
    supportedPoolVariants: input.supportedPoolVariants || DEFAULT_CREATOR_VARIANTS
  })

  return {
    draftId: input.draftId || stableId(`creator-draft-${input.title}`, {
      title: input.title,
      organizerId: input.organizerId
    }),
    competitionId: input.competitionId || null,
    title: input.title,
    organizerId: input.organizerId,
    category: input.category || template.sportOrCategory || 'creator',
    template,
    entrants: normalizeEntrants(input.entrants || [], template.entrantShape),
    fixtures: cloneJson(input.fixtures || []),
    status: input.status || 'draft',
    metadata: cloneJson(input.metadata || {})
  }
}

function addEntrantToCreatorDraft (draft, entrantInput = {}) {
  assertCreatorDraft(draft)
  const entrant = normalizeEntrants([entrantInput], draft.template && draft.template.entrantShape || 'custom')[0]
  if ((draft.entrants || []).some(item => item.entrantId === entrant.entrantId)) {
    throw new Error(`entrant already exists in creator draft: ${entrant.entrantId}`)
  }
  return {
    ...draft,
    entrants: cloneJson(draft.entrants || []).concat(entrant),
    status: draft.status === 'published' ? 'seeded' : draft.status
  }
}

function seedCreatorBracketDraft (draft, options = {}) {
  assertCreatorDraft(draft)
  const entrants = normalizeEntrants(options.entrants || draft.entrants || [], draft.template.entrantShape)
  const competitionId = options.competitionId || draft.competitionId || stableId(`competition-${slugify(draft.title)}`, {
    draftId: draft.draftId,
    title: draft.title
  })
  const bracketSize = bracketSizeFor({
    entrantCount: entrants.length,
    bracketSize: options.bracketSize,
    allowByes: options.allowByes !== false
  })
  const fixtures = createSeededBracketFixtures({
    competitionId,
    entrants,
    bracketSize,
    startsAt: options.startsAt || null
  })

  return {
    ...draft,
    competitionId,
    entrants,
    fixtures,
    status: 'seeded',
    bracket: {
      kind: 'single-elimination',
      bracketSize,
      entrantCount: entrants.length,
      byeCount: bracketSize - entrants.length,
      seeding: options.seeding || 'standard'
    }
  }
}

function createSeededBracketFixtures ({ competitionId, entrants = [], bracketSize, startsAt = null } = {}) {
  assertNonEmptyString(competitionId, 'competitionId')
  const normalizedEntrants = normalizeEntrants(entrants)
  const size = bracketSizeFor({
    entrantCount: normalizedEntrants.length,
    bracketSize,
    allowByes: true
  })
  const seededEntrants = normalizedEntrants.slice().sort(compareSeeds)
  const seedOrder = seedOrderForBracket(size)
  const firstRoundSlots = seedOrder.map(seed => {
    const entrant = seededEntrants[seed - 1]
    if (!entrant) return { type: 'bye', seed }
    return {
      type: 'entrant',
      entrantId: entrant.entrantId,
      seed: entrant.seed || seed
    }
  })
  const roundCount = Math.log2(size)
  const byeCount = firstRoundSlots.filter(slot => slot.type === 'bye').length
  const fixtures = []

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber += 1) {
    const matchCount = size / Math.pow(2, roundNumber)
    for (let fixtureIndex = 0; fixtureIndex < matchCount; fixtureIndex += 1) {
      const sourceSlots = roundNumber === 1
        ? firstRoundSlots.slice(fixtureIndex * 2, fixtureIndex * 2 + 2)
        : [
            { type: 'winner', fixtureId: fixtureIdFor(competitionId, roundNumber - 1, fixtureIndex * 2) },
            { type: 'winner', fixtureId: fixtureIdFor(competitionId, roundNumber - 1, fixtureIndex * 2 + 1) }
          ]
      const entrantSlots = sourceSlots.filter(slot => slot.type === 'entrant')
      fixtures.push({
        fixtureId: fixtureIdFor(competitionId, roundNumber, fixtureIndex),
        competitionId,
        stageId: `${competitionId}:stage:creator-bracket`,
        roundNumber,
        roundName: defaultRoundName(matchCount),
        fixtureIndex,
        startsAt,
        status: 'scheduled',
        sourceSlots,
        resultFields: ['winnerEntrantId'],
        metadata: {
          bracketSize: size,
          byeCount,
          hasBye: sourceSlots.some(slot => slot.type === 'bye'),
          autoAdvanceEntrantId: sourceSlots.some(slot => slot.type === 'bye') && entrantSlots.length === 1
            ? entrantSlots[0].entrantId
            : null
        },
        result: null
      })
    }
  }

  return fixtures
}

function createCreatorPublishPlan (draft, input = {}) {
  assertCreatorDraft(draft)
  const prepared = (draft.fixtures || []).length
    ? draft
    : seedCreatorBracketDraft(draft, {
        competitionId: input.competitionId || draft.competitionId || undefined,
        startsAt: input.startsAt || null,
        allowByes: input.allowByes !== false
      })
  const competitionId = input.competitionId || prepared.competitionId || stableId(`competition-${slugify(prepared.title)}`, {
    draftId: prepared.draftId,
    title: prepared.title
  })
  const roomId = input.roomId || `${competitionId}:room:main`
  const hostUserId = input.hostUserId || prepared.organizerId
  const settlementMode = input.mode || input.settlementMode || 'demo'
  const gates = cloneJson(input.gates || {})
  const variantIds = input.variantIds || input.poolVariants || prepared.template.supportedPoolVariants || DEFAULT_CREATOR_VARIANTS
  const baseAt = input.occurredAt || DEFAULT_CREATOR_LAUNCH_AT
  const commands = []

  commands.push(commandAt({
    type: 'competition:create',
    actorId: hostUserId,
    occurredAt: baseAt,
    index: commands.length,
    payload: {
      competitionId,
      title: input.title || prepared.title,
      category: input.category || prepared.category || 'creator',
      organizerId: prepared.organizerId,
      status: 'draft',
      startsAt: input.startsAt || null,
      template: prepared.template,
      entrants: cloneJson(prepared.entrants),
      fixtures: cloneJson(prepared.fixtures)
    }
  }))

  variantIds.forEach(variantId => {
    commands.push(commandAt({
      type: 'pool:create',
      actorId: hostUserId,
      occurredAt: baseAt,
      index: commands.length,
      payload: {
        poolId: poolIdFor({ input, competitionId, variantId }),
        competitionId,
        title: titleForVariant(variantId),
        variant: variantId,
        mode: settlementMode,
        gates
      }
    }))
  })

  commands.push(commandAt({
    type: 'room:create',
    actorId: hostUserId,
    occurredAt: baseAt,
    index: commands.length,
    payload: {
      roomId,
      competitionId,
      fixtureId: input.fixtureId || null,
      title: input.roomTitle || `${prepared.title} watch room`,
      hostUserId,
      status: input.roomStatus || 'scheduled',
      access: input.access || 'public'
    }
  }))
  commands.push(commandAt({
    type: 'room:join',
    actorId: hostUserId,
    occurredAt: baseAt,
    index: commands.length,
    payload: {
      roomId,
      userId: hostUserId,
      username: input.hostName || hostUserId,
      role: 'host'
    }
  }))
  commands.push(commandAt({
    type: 'competition:updateStatus',
    actorId: hostUserId,
    occurredAt: baseAt,
    index: commands.length,
    payload: {
      competitionId,
      status: input.publishStatus || 'open'
    }
  }))

  return {
    creatorPublishPlanId: input.creatorPublishPlanId || stableId(`creator-publish-${prepared.draftId}`, {
      competitionId,
      variantIds,
      settlementMode
    }),
    draftId: prepared.draftId,
    organizerId: prepared.organizerId,
    title: input.title || prepared.title,
    competitionId,
    roomId,
    settlementMode,
    poolIds: variantIds.map(variantId => poolIdFor({ input, competitionId, variantId })),
    variantIds: cloneJson(variantIds),
    commands,
    topics: [
      { kind: 'creator', id: prepared.organizerId },
      { kind: 'competition', id: competitionId },
      ...variantIds.map(variantId => ({ kind: 'pool', id: poolIdFor({ input, competitionId, variantId }) })),
      { kind: 'room', id: roomId }
    ],
    checklist: [
      'confirm-entrants',
      'seed-bracket',
      'publish-pools',
      'open-watch-room',
      prepared.template.resultPolicy === 'host-entered' ? 'assign-host-result-review' : 'connect-official-results'
    ]
  }
}

function createCreatorLaunchScenario (draft, input = {}) {
  const plan = createCreatorPublishPlan(draft, input)
  return {
    scenarioId: input.scenarioId || `creator-publish-${plan.draftId}`,
    title: plan.title,
    topics: plan.topics,
    commands: plan.commands,
    creatorPublishPlan: {
      creatorPublishPlanId: plan.creatorPublishPlanId,
      draftId: plan.draftId,
      competitionId: plan.competitionId,
      roomId: plan.roomId,
      settlementMode: plan.settlementMode,
      poolIds: cloneJson(plan.poolIds),
      checklist: cloneJson(plan.checklist)
    }
  }
}

function createCreatorResultPlan (input = {}) {
  assertNonEmptyString(input.competitionId, 'competitionId')
  const actorId = input.actorId || input.hostUserId || 'host'
  const baseAt = input.occurredAt || DEFAULT_CREATOR_LAUNCH_AT
  const snapshot = createResultSnapshot({
    snapshotId: input.snapshotId,
    competitionId: input.competitionId,
    sourcePolicy: input.sourcePolicy || 'host-entered',
    sourceId: input.sourceId || actorId,
    sourceActorId: actorId,
    recordedAt: input.recordedAt || baseAt,
    results: input.results || {},
    cardResults: input.cardResults || {}
  })
  const commands = [commandAt({
    type: 'result:record',
    actorId,
    occurredAt: baseAt,
    index: 0,
    payload: {
      snapshotId: snapshot.snapshotId,
      competitionId: input.competitionId,
      sourcePolicy: snapshot.sourcePolicy,
      sourceId: snapshot.sourceId,
      sourceActorId: snapshot.sourceActorId,
      recordedAt: snapshot.recordedAt,
      results: cloneJson(snapshot.results),
      cardResults: cloneJson(snapshot.cardResults)
    }
  })]

  ;(input.poolIds || []).forEach(poolId => {
    commands.push(commandAt({
      type: 'pool:resolve',
      actorId,
      occurredAt: baseAt,
      index: commands.length,
      payload: {
        poolId,
        resultSnapshotId: snapshot.snapshotId
      }
    }))
  })

  return {
    creatorResultPlanId: input.creatorResultPlanId || stableId(`creator-result-${input.competitionId}`, {
      snapshotId: snapshot.snapshotId,
      poolIds: input.poolIds || []
    }),
    competitionId: input.competitionId,
    snapshot,
    poolIds: cloneJson(input.poolIds || []),
    commands
  }
}

function createCreatorWorkbench (input = {}) {
  const view = input.view || {}
  const userId = input.userId || 'local-peer'
  const now = input.now || new Date().toISOString()
  const drafts = values(view.creatorCompetitionDrafts)
    .filter(draft => draft.organizerId === userId)
    .sort(compareDrafts)
  const hostedCompetitionIds = new Set(values(view.rooms)
    .filter(room => room.hostUserId === userId)
    .map(room => room.competitionId))
  const competitions = values(view.competitions)
    .filter(competition => competition.organizerId === userId || hostedCompetitionIds.has(competition.competitionId))
    .sort(compareTitles)
  const publishPlans = values(view.creatorPublishPlans)
    .filter(plan => plan.organizerId === userId)
    .sort(comparePlans)
  const selectedDraft = input.draftId
    ? drafts.find(draft => draft.draftId === input.draftId) || null
    : drafts[0] || null
  const selectedCompetition = input.competitionId
    ? competitions.find(competition => competition.competitionId === input.competitionId) || null
    : competitions.find(competition => competition.resultPolicy === 'host-entered') || competitions[0] || null

  return {
    workbenchId: stableId(`creator-workbench-${userId}`, {
      draftIds: drafts.map(draft => draft.draftId),
      competitionIds: competitions.map(competition => competition.competitionId),
      publishPlanIds: publishPlans.map(plan => plan.creatorPublishPlanId)
    }),
    userId,
    generatedAt: now,
    counts: {
      drafts: drafts.length,
      readyDrafts: drafts.filter(draft => publishRequirementsForDraft(draft).ready).length,
      competitions: competitions.length,
      resultQueues: competitions.filter(competition => competition.resultPolicy === 'host-entered').length,
      publishPlans: publishPlans.length
    },
    drafts: drafts.map(draftSummary),
    competitions: competitions.map(competitionSummary),
    selectedDraftId: selectedDraft && selectedDraft.draftId || null,
    selectedCompetitionId: selectedCompetition && selectedCompetition.competitionId || null,
    draftEditor: selectedDraft
      ? createCreatorDraftEditorModel({ draft: selectedDraft, userId })
      : null,
    publish: createCreatorPublishControls({
      draft: selectedDraft,
      publishPlans,
      userId,
      input
    }),
    results: createCreatorResultEntryModel({
      view,
      userId,
      competitionId: selectedCompetition && selectedCompetition.competitionId || null
    })
  }
}

function createCreatorDraftEditorModel ({ draft, userId = 'local-peer' } = {}) {
  assertCreatorDraft(draft)
  const nextSeed = (draft.entrants || []).length + 1
  const requirements = publishRequirementsForDraft(draft)

  return {
    draft: draftSummary(draft),
    entrantRows: (draft.entrants || [])
      .slice()
      .sort(compareSeeds)
      .map(entrant => ({
        entrantId: entrant.entrantId,
        name: entrant.name,
        seed: entrant.seed,
        shape: entrant.shape,
        metadata: cloneJson(entrant.metadata || {})
      })),
    bracketRounds: roundsForFixtures(draft.fixtures || [], draft.entrants || []),
    controls: {
      canAddEntrant: true,
      canSeedBracket: (draft.entrants || []).length >= 2,
      canPublish: requirements.ready,
      missingRequirements: requirements.missing
    },
    commandDrafts: {
      addEntrant: {
        type: 'creator:addEntrant',
        actorId: userId,
        payload: {
          draftId: draft.draftId,
          entrant: {
            name: '',
            seed: nextSeed,
            shape: draft.template.entrantShape
          }
        }
      },
      seedBracket: {
        type: 'creator:seedBracket',
        actorId: userId,
        payload: {
          draftId: draft.draftId,
          competitionId: draft.competitionId || stableId(`competition-${slugify(draft.title)}`, {
            draftId: draft.draftId,
            title: draft.title
          }),
          allowByes: true
        }
      },
      createPublishPlan: {
        type: 'creator:createPublishPlan',
        actorId: userId,
        payload: {
          draftId: draft.draftId,
          competitionId: draft.competitionId || stableId(`competition-${slugify(draft.title)}`, {
            draftId: draft.draftId,
            title: draft.title
          }),
          variantIds: cloneJson(draft.template.supportedPoolVariants || DEFAULT_CREATOR_VARIANTS),
          settlementMode: 'demo'
        }
      }
    }
  }
}

function createCreatorPublishControls ({ draft = null, publishPlans = [], userId = 'local-peer', input = {} } = {}) {
  if (!draft) {
    return {
      selectedDraftId: null,
      ready: false,
      missingRequirements: ['select-draft'],
      savedPlans: [],
      previewPlan: null,
      commandDraft: null
    }
  }

  const requirements = publishRequirementsForDraft(draft)
  const savedPlans = publishPlans
    .filter(plan => plan.draftId === draft.draftId)
    .map(plan => publishPlanSummary(plan))
  const previewPlan = requirements.ready
    ? createCreatorPublishPlan(draft, {
        competitionId: input.competitionId || draft.competitionId || undefined,
        variantIds: input.variantIds || draft.template.supportedPoolVariants || DEFAULT_CREATOR_VARIANTS,
        settlementMode: input.settlementMode || 'demo',
        roomId: input.roomId
      })
    : null

  return {
    selectedDraftId: draft.draftId,
    ready: requirements.ready,
    missingRequirements: requirements.missing,
    savedPlans,
    previewPlan: previewPlan
      ? publishPlanSummary(previewPlan)
      : null,
    commandDraft: {
      type: 'creator:createPublishPlan',
      actorId: userId,
      payload: {
        draftId: draft.draftId,
        competitionId: draft.competitionId || previewPlan && previewPlan.competitionId || null,
        variantIds: cloneJson(draft.template.supportedPoolVariants || DEFAULT_CREATOR_VARIANTS),
        settlementMode: input.settlementMode || 'demo'
      }
    }
  }
}

function createCreatorResultEntryModel ({ view = {}, userId = 'local-peer', competitionId = null } = {}) {
  const hostedCompetitionIds = new Set(values(view.rooms)
    .filter(room => room.hostUserId === userId)
    .map(room => room.competitionId))
  const competitions = values(view.competitions)
    .filter(competition => competition.resultPolicy === 'host-entered')
    .filter(competition => competition.organizerId === userId || hostedCompetitionIds.has(competition.competitionId))
    .sort(compareTitles)
  const competition = competitionId
    ? competitions.find(item => item.competitionId === competitionId) || null
    : competitions[0] || null

  if (!competition) {
    return {
      selectedCompetitionId: null,
      resultQueues: competitions.map(competitionSummary),
      fixtureRows: [],
      linkedPools: [],
      latestSnapshot: null,
      review: {
        status: 'no-competition',
        canRecord: false,
        canCorrect: false,
        canSettle: false,
        missingFixtureIds: [],
        unsettledPoolIds: []
      },
      commandDraft: null
    }
  }

  const snapshots = values(view.resultSnapshots)
    .filter(snapshot => snapshot.competitionId === competition.competitionId)
    .sort(compareSnapshots)
  const latestSnapshot = snapshots[0] || null
  const linkedPools = values(view.pools)
    .filter(pool => pool.competitionId === competition.competitionId)
    .sort(compareTitles)
  const linkedCards = values(view.cards)
    .filter(card => card.competitionId === competition.competitionId)
    .sort(compareTitles)
  const fixtureRows = (competition.fixtures || [])
    .slice()
    .sort(compareFixtures)
    .map(fixture => resultFixtureRow({
      fixture,
      entrants: competition.entrants || [],
      result: latestSnapshot && latestSnapshot.results && latestSnapshot.results[fixture.fixtureId] || fixture.result || null
    }))
  const resultRows = fixtureRows.reduce((accumulator, fixture) => {
    accumulator[fixture.fixtureId] = {
      winnerEntrantId: fixture.result && fixture.result.winnerEntrantId || null,
      roundNumber: fixture.roundNumber
    }
    return accumulator
  }, {})
  const cardRows = linkedCards.map(card => resultCardRow({
    card,
    latestSnapshot,
    resolution: view.cardResolutions && view.cardResolutions[card.cardId] || null
  }))
  const cardResults = cardRows.reduce((accumulator, cardRow) => {
    Object.assign(accumulator, cardRow.results)
    return accumulator
  }, {})
  const linkedPoolRows = linkedPools.map(pool => resultPoolRow({
    pool,
    settlement: view.poolSettlements && view.poolSettlements[pool.poolId] || null,
    latestSnapshot
  }))
  const review = resultReviewFor({
    competition,
    fixtureRows,
    linkedPools: linkedPoolRows,
    linkedCards: cardRows,
    latestSnapshot
  })

  return {
    selectedCompetitionId: competition.competitionId,
    resultQueues: competitions.map(competitionSummary),
    fixtureRows,
    cardRows,
    linkedPools: linkedPoolRows,
    latestSnapshot: latestSnapshot
      ? {
          snapshotId: latestSnapshot.snapshotId,
          sourcePolicy: latestSnapshot.sourcePolicy,
          sourceActorId: latestSnapshot.sourceActorId || null,
          recordedAt: latestSnapshot.recordedAt,
          resultCount: Object.keys(latestSnapshot.results || {}).length,
          corrected: Boolean(latestSnapshot.correction),
          correctionReason: latestSnapshot.correction && latestSnapshot.correction.reason || null
        }
      : null,
    review,
    commandDraft: {
      planType: 'creator-result-plan',
      hostUserId: userId,
      competitionId: competition.competitionId,
      poolIds: linkedPoolRows.filter(pool => pool.needsSettlement).map(pool => pool.poolId),
      results: resultRows,
      cardResults,
      ready: review.canRecord,
      missingFixtureIds: cloneJson(review.missingFixtureIds),
      missingCardFieldIds: cloneJson(review.missingCardFieldIds)
    },
    correctionDraft: latestSnapshot
      ? {
          type: 'result:correct',
          actorId: userId,
          payload: {
            snapshotId: latestSnapshot.snapshotId,
            hostUserId: userId,
            reason: 'host result correction',
            results: resultRows,
            cardResults
          }
        }
      : null,
    settlementCommandDrafts: latestSnapshot
      ? linkedPoolRows
          .filter(pool => pool.needsSettlement)
          .map(pool => ({
            type: 'pool:resolve',
            actorId: userId,
            payload: {
              poolId: pool.poolId,
              resultSnapshotId: latestSnapshot.snapshotId
            }
          }))
      : [],
    cardResolveCommandDrafts: latestSnapshot
      ? cardRows
          .filter(cardRow => cardRow.needsResolution)
          .map(cardRow => ({
            type: 'card:resolve',
            actorId: userId,
            payload: {
              cardId: cardRow.cardId,
              results: cloneJson(cardRow.results)
            }
          }))
      : []
  }
}

function resultCardRow ({ card, latestSnapshot = null, resolution = null }) {
  const snapshotResults = latestSnapshot && latestSnapshot.cardResults || {}
  const fields = (card.fields || []).map(field => {
    const actual = Object.prototype.hasOwnProperty.call(snapshotResults, field.fieldId)
      ? snapshotResults[field.fieldId]
      : null
    return {
      fieldId: field.fieldId,
      fieldType: field.fieldType,
      label: field.label,
      required: field.required !== false,
      actual: cloneJson(actual),
      needsResult: field.required !== false && actual == null
    }
  })
  const results = fields.reduce((accumulator, field) => {
    accumulator[field.fieldId] = cloneJson(field.actual)
    return accumulator
  }, {})
  return {
    cardId: card.cardId,
    competitionId: card.competitionId,
    title: card.title,
    cardType: card.cardType,
    fieldCount: fields.length,
    resultCount: fields.filter(field => !field.needsResult).length,
    missingFieldIds: fields.filter(field => field.needsResult).map(field => field.fieldId),
    fields,
    results,
    resolved: Boolean(resolution),
    resolutionId: resolution && resolution.resolutionId || null,
    resolutionMatchesSnapshot: cardResolutionMatchesSnapshot({ resolution, results }),
    needsResolution: Boolean(latestSnapshot) && fields.every(field => !field.needsResult) &&
      !cardResolutionMatchesSnapshot({ resolution, results })
  }
}

function resultPoolRow ({ pool, settlement = null, latestSnapshot = null }) {
  const settlementSnapshotId = settlement && settlement.resultSnapshotId || null
  const latestSnapshotId = latestSnapshot && latestSnapshot.snapshotId || null
  return {
    poolId: pool.poolId,
    title: pool.title,
    variant: pool.rules && pool.rules.variant,
    mode: pool.mode,
    status: pool.status,
    settled: Boolean(settlement),
    settlementSnapshotId,
    needsSettlement: Boolean(latestSnapshotId && settlementSnapshotId !== latestSnapshotId)
  }
}

function resultReviewFor ({ competition, fixtureRows = [], linkedPools = [], linkedCards = [], latestSnapshot = null } = {}) {
  const missingFixtureIds = fixtureRows
    .filter(row => row.needsResult)
    .map(row => row.fixtureId)
  const missingCardFieldIds = linkedCards.flatMap(card => {
    return card.missingFieldIds.map(fieldId => `${card.cardId}:${fieldId}`)
  })
  const unsettledPoolIds = linkedPools
    .filter(pool => pool.needsSettlement)
    .map(pool => pool.poolId)
  const unresolvedCardIds = linkedCards
    .filter(card => card.needsResolution)
    .map(card => card.cardId)
  const hasResultTargets = fixtureRows.length > 0 || linkedCards.length > 0
  const canRecord = hasResultTargets && missingFixtureIds.length === 0 && missingCardFieldIds.length === 0
  const canCorrect = Boolean(latestSnapshot)
  const canSettle = Boolean(latestSnapshot) && missingFixtureIds.length === 0 && missingCardFieldIds.length === 0 && unsettledPoolIds.length > 0
  const canResolveCards = Boolean(latestSnapshot) && missingCardFieldIds.length === 0 && unresolvedCardIds.length > 0
  const status = !latestSnapshot
    ? canRecord ? 'ready-to-record' : 'needs-results'
    : missingFixtureIds.length || missingCardFieldIds.length
        ? 'needs-correction'
        : unsettledPoolIds.length || unresolvedCardIds.length
            ? 'ready-to-settle'
            : 'settled'

  return {
    status,
    resultPolicy: competition && competition.resultPolicy || null,
    fixtureCount: fixtureRows.length,
    resultCount: fixtureRows.length - missingFixtureIds.length,
    cardCount: linkedCards.length,
    cardResultCount: linkedCards.reduce((sum, card) => sum + card.resultCount, 0),
    missingFixtureIds,
    missingCardFieldIds,
    linkedPoolIds: linkedPools.map(pool => pool.poolId),
    linkedCardIds: linkedCards.map(card => card.cardId),
    settledPoolIds: linkedPools.filter(pool => pool.settled && !pool.needsSettlement).map(pool => pool.poolId),
    unsettledPoolIds,
    resolvedCardIds: linkedCards.filter(card => card.resolved && !card.needsResolution).map(card => card.cardId),
    unresolvedCardIds,
    latestSnapshotId: latestSnapshot && latestSnapshot.snapshotId || null,
    latestSnapshotCorrected: Boolean(latestSnapshot && latestSnapshot.correction),
    canRecord,
    canCorrect,
    canSettle,
    canResolveCards
  }
}

function cardResolutionMatchesSnapshot ({ resolution = null, results = {} } = {}) {
  if (!resolution) return false
  return stableJson(resolution.results || {}) === stableJson(results || {})
}

function stableJson (value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function publishCreatorCompetition (draft, publishedAt = new Date().toISOString()) {
  if (!draft || typeof draft !== 'object') throw new TypeError('draft is required')
  return {
    ...draft,
    publishedAt,
    status: 'published'
  }
}

function createCreatorResultCorrection (input = {}) {
  return createHostResultCorrection(input)
}

function bracketSizeFor ({ entrantCount, bracketSize, allowByes }) {
  if (!Number.isInteger(entrantCount) || entrantCount < 2) {
    throw new RangeError('creator bracket requires at least 2 entrants')
  }
  if (bracketSize != null) {
    const requested = Number(bracketSize)
    if (!Number.isInteger(requested) || !isPowerOfTwo(requested) || requested < 2) {
      throw new RangeError('bracketSize must be a power of two and at least 2')
    }
    if (requested < entrantCount) throw new RangeError('bracketSize cannot be smaller than entrant count')
    if (!allowByes && requested !== entrantCount) throw new RangeError('bracketSize must match entrant count when byes are disabled')
    return requested
  }
  if (isPowerOfTwo(entrantCount)) return entrantCount
  if (!allowByes) throw new RangeError('creator bracket entrants must be a power of two when byes are disabled')
  return nextPowerOfTwo(entrantCount)
}

function nextPowerOfTwo (value) {
  let size = 1
  while (size < value) size *= 2
  return size
}

function seedOrderForBracket (size) {
  if (!isPowerOfTwo(size) || size < 2) throw new RangeError('seed bracket size must be a power of two and at least 2')
  if (size === 2) return [1, 2]
  return seedOrderForBracket(size / 2).flatMap(seed => [seed, size + 1 - seed])
}

function compareSeeds (left, right) {
  const leftSeed = Number.isFinite(Number(left.seed)) ? Number(left.seed) : Number.MAX_SAFE_INTEGER
  const rightSeed = Number.isFinite(Number(right.seed)) ? Number(right.seed) : Number.MAX_SAFE_INTEGER
  if (leftSeed !== rightSeed) return leftSeed - rightSeed
  return String(left.name).localeCompare(String(right.name))
}

function commandAt ({ type, actorId, occurredAt, index, payload }) {
  return {
    type,
    actorId,
    occurredAt: offsetIso(occurredAt, index),
    payload
  }
}

function offsetIso (iso, index) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Date(date.getTime() + index * 60000).toISOString()
}

function poolIdFor ({ input, competitionId, variantId }) {
  if (input.poolIds && input.poolIds[variantId]) return input.poolIds[variantId]
  return `${competitionId}:pool:${variantId}`
}

function titleForVariant (variantId) {
  return variantId
    .split('-')
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function assertCreatorDraft (draft) {
  if (!draft || typeof draft !== 'object') throw new TypeError('draft is required')
  assertNonEmptyString(draft.draftId, 'draftId')
  assertNonEmptyString(draft.organizerId, 'organizerId')
  if (!draft.template || typeof draft.template !== 'object') throw new TypeError('draft.template is required')
}

function publishRequirementsForDraft (draft) {
  const missing = []
  if (!draft) missing.push('select-draft')
  if (draft && (!draft.title || String(draft.title).trim() === '')) missing.push('title')
  if (draft && (!Array.isArray(draft.entrants) || draft.entrants.length < 2)) missing.push('at-least-two-entrants')
  if (draft && (!Array.isArray(draft.fixtures) || draft.fixtures.length === 0)) missing.push('seed-bracket')
  return {
    ready: missing.length === 0,
    missing
  }
}

function roundsForFixtures (fixtures = [], entrants = []) {
  const entrantMap = new Map((entrants || []).map(entrant => [entrant.entrantId, entrant]))
  const rounds = new Map()
  fixtures
    .slice()
    .sort(compareFixtures)
    .forEach(fixture => {
      const roundNumber = fixture.roundNumber || 1
      if (!rounds.has(roundNumber)) {
        rounds.set(roundNumber, {
          roundNumber,
          roundName: fixture.roundName || defaultRoundName(1),
          fixtures: []
        })
      }
      rounds.get(roundNumber).fixtures.push({
        fixtureId: fixture.fixtureId,
        roundNumber,
        roundName: fixture.roundName || rounds.get(roundNumber).roundName,
        fixtureIndex: fixture.fixtureIndex,
        status: fixture.status,
        sourceSlots: sourceSlotSummaries(fixture.sourceSlots || [], entrantMap),
        result: cloneJson(fixture.result || null),
        metadata: cloneJson(fixture.metadata || {})
      })
    })
  return [...rounds.values()]
}

function sourceSlotSummaries (sourceSlots = [], entrantMap = new Map()) {
  return sourceSlots.map(slot => {
    if (slot.type === 'entrant') {
      const entrant = entrantMap.get(slot.entrantId)
      return {
        type: 'entrant',
        entrantId: slot.entrantId,
        seed: slot.seed || entrant && entrant.seed || null,
        label: entrant && entrant.name || slot.entrantId
      }
    }
    if (slot.type === 'winner') {
      return {
        type: 'winner',
        fixtureId: slot.fixtureId,
        label: `Winner of ${slot.fixtureId}`
      }
    }
    if (slot.type === 'bye') {
      return {
        type: 'bye',
        seed: slot.seed || null,
        label: 'Bye'
      }
    }
    return {
      ...cloneJson(slot),
      label: slot.label || slot.entrantId || slot.fixtureId || slot.type || 'Slot'
    }
  })
}

function resultFixtureRow ({ fixture, entrants = [], result = null }) {
  const entrantMap = new Map((entrants || []).map(entrant => [entrant.entrantId, entrant]))
  const sourceSlots = sourceSlotSummaries(fixture.sourceSlots || [], entrantMap)
  return {
    fixtureId: fixture.fixtureId,
    roundNumber: fixture.roundNumber || 1,
    roundName: fixture.roundName || null,
    fixtureIndex: fixture.fixtureIndex || 0,
    status: fixture.status,
    sourceSlots,
    winnerOptions: sourceSlots
      .filter(slot => slot.type === 'entrant')
      .map(slot => ({
        entrantId: slot.entrantId,
        label: slot.label,
        seed: slot.seed || null
      })),
    result: cloneJson(result),
    needsResult: !result || !result.winnerEntrantId
  }
}

function draftSummary (draft) {
  const requirements = publishRequirementsForDraft(draft)
  return {
    draftId: draft.draftId,
    competitionId: draft.competitionId || null,
    title: draft.title,
    category: draft.category,
    status: draft.status,
    templateKind: draft.template && draft.template.kind,
    entrantShape: draft.template && draft.template.entrantShape,
    resultPolicy: draft.template && draft.template.resultPolicy,
    entrantCount: (draft.entrants || []).length,
    fixtureCount: (draft.fixtures || []).length,
    bracketSize: draft.bracket && draft.bracket.bracketSize || null,
    byeCount: draft.bracket && draft.bracket.byeCount || 0,
    readyToPublish: requirements.ready,
    missingRequirements: requirements.missing
  }
}

function competitionSummary (competition) {
  return {
    competitionId: competition.competitionId,
    title: competition.title,
    category: competition.category,
    status: competition.status,
    resultPolicy: competition.resultPolicy,
    entrantCount: (competition.entrantIds || competition.entrants || []).length,
    fixtureCount: (competition.fixtureIds || competition.fixtures || []).length
  }
}

function publishPlanSummary (plan) {
  return {
    creatorPublishPlanId: plan.creatorPublishPlanId,
    draftId: plan.draftId,
    competitionId: plan.competitionId,
    roomId: plan.roomId,
    settlementMode: plan.settlementMode,
    variantIds: cloneJson(plan.variantIds || []),
    poolIds: cloneJson(plan.poolIds || []),
    commandCount: (plan.commands || []).length,
    topicCount: (plan.topics || []).length,
    checklist: cloneJson(plan.checklist || [])
  }
}

function compareDrafts (left, right) {
  return String(left.title || left.draftId).localeCompare(String(right.title || right.draftId))
}

function compareTitles (left, right) {
  return String(left.title || left.competitionId || left.poolId).localeCompare(String(right.title || right.competitionId || right.poolId))
}

function comparePlans (left, right) {
  return String(left.title || left.creatorPublishPlanId).localeCompare(String(right.title || right.creatorPublishPlanId))
}

function compareSnapshots (left, right) {
  return String(right.recordedAt || '').localeCompare(String(left.recordedAt || ''))
}

function compareFixtures (left, right) {
  const leftRound = Number(left.roundNumber || 0)
  const rightRound = Number(right.roundNumber || 0)
  if (leftRound !== rightRound) return leftRound - rightRound
  return Number(left.fixtureIndex || 0) - Number(right.fixtureIndex || 0)
}

function values (collection = {}) {
  return Object.values(collection || {})
}

module.exports = {
  DEFAULT_CREATOR_VARIANTS,
  createCreatorCompetitionDraft,
  addEntrantToCreatorDraft,
  seedCreatorBracketDraft,
  createSeededBracketFixtures,
  createCreatorPublishPlan,
  createCreatorLaunchScenario,
  createCreatorResultPlan,
  createCreatorWorkbench,
  createCreatorDraftEditorModel,
  createCreatorPublishControls,
  createCreatorResultEntryModel,
  publishCreatorCompetition,
  createCreatorResultCorrection,
  bracketSizeFor,
  nextPowerOfTwo,
  seedOrderForBracket,
  publishRequirementsForDraft,
  roundsForFixtures
}
