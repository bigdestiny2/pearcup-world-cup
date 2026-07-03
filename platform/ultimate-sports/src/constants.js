'use strict'

const EVENT_TEMPLATE_KINDS = Object.freeze([
  'single-elimination',
  'double-elimination',
  'group-plus-knockout',
  'series-playoff',
  'round-robin',
  'fight-card',
  'awards-card',
  'draft-slate',
  'bingo-card',
  'creator-custom'
])

const ENTRANT_SHAPES = Object.freeze([
  'team',
  'player',
  'pair',
  'nominee',
  'creator',
  'custom'
])

const RESULT_POLICIES = Object.freeze([
  'official-feed',
  'host-entered',
  'hybrid'
])

const POOL_VARIANTS = Object.freeze([
  'classic-bracket',
  'confidence',
  'survivor',
  'upset-bounty',
  'head-to-head-duel',
  'group-stage-card',
  'fantasy-lite-draft',
  'watch-party-bingo',
  'next-event',
  'scoreline-lock',
  'player-prop',
  'side-quest'
])

const ENTRY_TYPES = Object.freeze([
  'bracket',
  'card',
  'survivor',
  'draft',
  'bingo',
  'live-prediction'
])

const SETTLEMENT_MODES = Object.freeze([
  'none',
  'demo',
  'sponsor-prize',
  'real-money'
])

const RISK_CLASSES = Object.freeze([
  'casual',
  'prize',
  'regulated'
])

const REAL_MONEY_GATES = Object.freeze([
  'qvacReady',
  'wdkReady',
  'kycVerified',
  'ageVerified',
  'jurisdictionAllowed',
  'responsiblePlayAccepted',
  'poolRulesAccepted',
  'paymentCapturedOrEscrowLocked',
  'payoutRouteDeclared',
  'officialResultSourceReady'
])

module.exports = {
  EVENT_TEMPLATE_KINDS,
  ENTRANT_SHAPES,
  RESULT_POLICIES,
  POOL_VARIANTS,
  ENTRY_TYPES,
  SETTLEMENT_MODES,
  RISK_CLASSES,
  REAL_MONEY_GATES
}
