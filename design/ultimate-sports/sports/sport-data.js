'use strict'

const ULTIMATE_SPORTS = [
  {
    sportId: 'soccer-world-cup',
    title: 'World Cup',
    category: 'soccer',
    serverLabel: 'Global Cup Server',
    status: 'live',
    playerCount: 1240,
    roomCount: 18,
    skin: 'stadium-flags',
    loader: 'kawaii',
    kawaiiPath: '../kawaii-app/index.html',
    pearLink: 'pear://kawaii-dev',
    accent: '#0f766e',
    description: 'Bracket pools, live watch parties, and P2P penalty matches.'
  },
  {
    sportId: 'mma-fight-card',
    title: 'Fight Card',
    category: 'combat-sports',
    serverLabel: 'Fight Card Server',
    status: 'live',
    playerCount: 340,
    roomCount: 7,
    skin: 'arena-card',
    loader: 'mma',
    accent: '#dc2626',
    description: 'Combat picks, method props, and between-fight trivia.'
  },
  {
    sportId: 'march-madness',
    title: 'March Madness',
    category: 'basketball',
    serverLabel: 'Madness Bracket Server',
    status: 'scheduled',
    playerCount: 0,
    roomCount: 0,
    skin: 'arena-regions',
    loader: 'placeholder',
    accent: '#1e40af',
    description: 'College bracket pools, upset bounties, and mini-fantasy.'
  },
  {
    sportId: 'pro-playoffs',
    title: 'Pro Playoffs',
    category: 'pro-sports',
    serverLabel: 'Pro Playoff Server',
    status: 'scheduled',
    playerCount: 0,
    roomCount: 0,
    skin: 'series-scoreboard',
    loader: 'placeholder',
    accent: '#111827',
    description: 'NBA, NHL, MLB playoff pools and series scoreboards.'
  },
  {
    sportId: 'tennis-grand-slams',
    title: 'Tennis Grand Slams',
    category: 'tennis',
    serverLabel: 'Grand Slam Draw Server',
    status: 'scheduled',
    playerCount: 0,
    roomCount: 0,
    skin: 'court-draw',
    loader: 'placeholder',
    accent: '#166534',
    description: 'Draw brackets, set-score locks, and player props.'
  },
  {
    sportId: 'esports-major',
    title: 'Esports Major',
    category: 'esports',
    serverLabel: 'Esports Major Server',
    status: 'live',
    playerCount: 620,
    roomCount: 12,
    skin: 'neon-arena',
    loader: 'placeholder',
    accent: '#14b8a6',
    description: 'Map-series pools, clutch duels, and meta trivia.'
  },
  {
    sportId: 'sailgp-companion',
    title: 'SailGP Companion',
    category: 'sailing',
    serverLabel: 'SailGP Companion Server',
    status: 'scheduled',
    playerCount: 0,
    roomCount: 0,
    skin: 'foiling-race-waterline',
    loader: 'placeholder',
    accent: '#0c4a6e',
    description: 'Fleet-race leaderboard, foil-time props, and wind maps.'
  },
  {
    sportId: 'creator-reality-brackets',
    title: 'Creator Tournaments',
    category: 'creator',
    serverLabel: 'Creator Show Server',
    status: 'scheduled',
    playerCount: 0,
    roomCount: 0,
    skin: 'creator-stage',
    loader: 'placeholder',
    accent: '#d97706',
    description: 'Fan-vote brackets and episode reveal pools.'
  },
  {
    sportId: 'awards-prediction-pools',
    title: 'Awards Night',
    category: 'awards',
    serverLabel: 'Awards Night Server',
    status: 'scheduled',
    playerCount: 0,
    roomCount: 0,
    skin: 'ceremony-card',
    loader: 'placeholder',
    accent: '#b98923',
    description: 'Oscars, Grammys, Eurovision prediction cards.'
  },
  {
    sportId: 'local-leagues',
    title: 'Local Leagues',
    category: 'local',
    serverLabel: 'Local League Server',
    status: 'scheduled',
    playerCount: 0,
    roomCount: 0,
    skin: 'community-scoreboard',
    loader: 'placeholder',
    accent: '#3f6212',
    description: 'School, office, pub, and rec sports pools.'
  }
]

function getLiveSports () {
  return ULTIMATE_SPORTS.filter(sport => sport.status === 'live')
}

function getSportById (sportId) {
  return ULTIMATE_SPORTS.find(sport => sport.sportId === sportId) || null
}

function totalOnlinePlayers () {
  return ULTIMATE_SPORTS.reduce((sum, sport) => sum + (sport.playerCount || 0), 0)
}
