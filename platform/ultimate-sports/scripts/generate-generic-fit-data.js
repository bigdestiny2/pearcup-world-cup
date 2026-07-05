#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const OUT_FILE = path.resolve(__dirname, '..', 'shell', 'fits', 'generic-fits.js')
const FIXTURES_DIR = path.resolve(__dirname, '..', 'shell', 'fits', 'fixtures')

function makeTheme (primary, secondary, accent, ink, soft, surface) {
  return {
    '--ink': ink || '#4a3b57',
    '--muted': '#a897b3',
    '--soft': soft || '#fff0f8',
    '--surface': surface || '#ffffff',
    '--surface-2': '#fdf5fb',
    '--surface-3': '#f6eeff',
    '--line': '#ffd9ee',
    '--line-strong': '#f3c8e2',
    '--green': primary,
    '--green-deep': accent,
    '--red': secondary,
    '--pink': secondary,
    '--pink-deep': accent,
    '--blue': '#7cc4ff',
    '--blue-deep': '#3a90dd',
    '--grape': '#b79bff',
    '--gold': '#f0b93f',
    '--lemon': '#ffd76b'
  }
}

const fits = [
  {
    id: 'euros-copa-america',
    title: 'Euros / Copa America',
    category: 'soccer',
    defaultTeam: 'fr',
    theme: makeTheme('#3b82f6', '#ef4444', '#1d4ed8', '#1e293b', '#eff6ff', '#ffffff'),
    entrants: [
      ['fr', 'France', '🇫🇷', ['#1d3d8f', '#ffffff', '#d84a3a']],
      ['de', 'Germany', '🇩🇪', ['#000000', '#dd0000', '#ffce00']],
      ['es', 'Spain', '🇪🇸', ['#c60b1e', '#ffc400', '#75131a']],
      ['eng', 'England', '🏴', ['#ffffff', '#d41f35', '#1c3764']],
      ['pt', 'Portugal', '🇵🇹', ['#d71920', '#006b3f', '#f6c343']],
      ['it', 'Italy', '🇮🇹', ['#009246', '#ffffff', '#ce2b37']],
      ['nl', 'Netherlands', '🇳🇱', ['#ae1c28', '#ffffff', '#21468b']],
      ['ar', 'Argentina', '🇦🇷', ['#75aadb', '#ffffff', '#f6b33f']],
      ['br', 'Brazil', '🇧🇷', ['#139b49', '#ffd447', '#1b55a5']],
      ['mx', 'Mexico', '🇲🇽', ['#0c8c57', '#ffffff', '#d43f3a']],
      ['co', 'Colombia', '🇨🇴', ['#fcd116', '#003893', '#ce1126']],
      ['us', 'United States', '🇺🇸', ['#ffffff', '#b31942', '#0a3161']],
      ['ca', 'Canada', '🇨🇦', ['#ff0000', '#ffffff', '#8a1538']],
      ['uy', 'Uruguay', '🇺🇾', ['#ffffff', '#0038a8', '#000000']],
      ['ec', 'Ecuador', '🇪🇨', ['#f9d33a', '#1f5aa6', '#d13d32']],
      ['cl', 'Chile', '🇨🇱', ['#ffffff', '#d52b1e', '#0039a6']]
    ],
    stats: [['Possession', '52%', '48%', 52], ['Shots', '11', '9', 55], ['xG', '1.45', '1.22', 54], ['Pass accuracy', '86%', '84%', 51], ['Corners', '5', '4', 56], ['Saves', '2', '3', 40]]
  },
  {
    id: 'champions-league-knockout',
    title: 'Champions League Knockout',
    category: 'soccer',
    defaultTeam: 'rm',
    theme: makeTheme('#0ea5e9', '#f59e0b', '#0369a1', '#0f172a', '#f0f9ff', '#ffffff'),
    entrants: [
      ['rm', 'Real Madrid', '🇪🇸', ['#ffffff', '#00529f', '#f7c600']],
      ['mc', 'Man City', '🏴', ['#6cabdd', '#ffffff', '#1c2044']],
      ['bay', 'Bayern', '🇩🇪', ['#dc052d', '#ffffff', '#0066b2']],
      ['psg', 'PSG', '🇫🇷', ['#004170', '#da291c', '#ffffff']],
      ['liv', 'Liverpool', '🏴', ['#c8102e', '#ffffff', '#00b2a9']],
      ['fcb', 'Barcelona', '🇪🇸', ['#a50044', '#004d98', '#edff00']],
      ['juv', 'Juventus', '🇮🇹', ['#000000', '#ffffff', '#d6d6d6']],
      ['dor', 'Dortmund', '🇩🇪', ['#fde100', '#000000', '#f0f0f0']],
      ['atm', 'Atletico', '🇪🇸', ['#cb3524', '#ffffff', '#1a3c6e']],
      ['int', 'Inter', '🇮🇹', ['#010e80', '#000000', '#ffffff']],
      ['mil', 'AC Milan', '🇮🇹', ['#fb090b', '#000000', '#ffffff']],
      ['ars', 'Arsenal', '🏴', ['#ef0107', '#ffffff', '#023474']],
      ['che', 'Chelsea', '🏴', ['#034694', '#ffffff', '#d1d3d4']],
      ['mun', 'Man United', '🏴', ['#da291c', '#ffffff', '#000000']],
      ['ben', 'Benfica', '🇵🇹', ['#e30613', '#ffffff', '#000000']],
      ['por', 'Porto', '🇵🇹', ['#003399', '#ffffff', '#000000']]
    ],
    stats: [['Possession', '54%', '46%', 54], ['Shots', '13', '8', 62], ['xG', '1.68', '1.05', 62], ['Pass accuracy', '88%', '83%', 57], ['Corners', '6', '3', 67], ['Saves', '2', '4', 33]]
  },
  {
    id: 'march-madness',
    title: 'March Madness',
    category: 'basketball',
    defaultTeam: 'uconn',
    theme: makeTheme('#f97316', '#3b82f6', '#c2410c', '#2a1510', '#fff7ed', '#ffffff'),
    entrants: [
      ['uconn', 'UConn', '🏀', ['#002868', '#ffffff', '#e4002b']],
      ['purdue', 'Purdue', '🏀', ['#ceb888', '#000000', '#ffffff']],
      ['unc', 'North Carolina', '🏀', ['#7bafd4', '#ffffff', '#101820']],
      ['duke', 'Duke', '🏀', ['#003087', '#ffffff', '#000000']],
      ['kansas', 'Kansas', '🏀', ['#0051ba', '#ffffff', '#e8000d']],
      ['zaga', 'Gonzaga', '🏀', ['#00295a', '#ffffff', '#c8102e']],
      ['houston', 'Houston', '🏀', ['#c8102e', '#ffffff', '#000000']],
      ['tn', 'Tennessee', '🏀', ['#ff8200', '#ffffff', '#000000']],
      ['auburn', 'Auburn', '🏀', ['#0c2340', '#ffffff', '#e87722']],
      ['ariz', 'Arizona', '🏀', ['#cc0033', '#ffffff', '#003366']],
      ['baylor', 'Baylor', '🏀', ['#154734', '#ffffff', '#ffb81c']],
      ['kent', 'Kentucky', '🏀', ['#0033a0', '#ffffff', '#000000']],
      ['marq', 'Marquette', '🏀', ['#003366', '#ffffff', '#f4c430']],
      ['mich', 'Michigan St', '🏀', ['#18453b', '#ffffff', '#000000']],
      ['fla', 'Florida', '🏀', ['#0021a5', '#ffffff', '#fa4616']],
      ['tex', 'Texas', '🏀', ['#bf5700', '#ffffff', '#333f48']]
    ],
    stats: [['Field Goals', '48%', '44%', 52], ['3-Pointers', '12', '9', 57], ['Rebounds', '34', '29', 54], ['Assists', '16', '12', 57], ['Turnovers', '8', '11', 42], ['Free Throws', '18', '14', 56]]
  },
  {
    id: 'pro-playoffs',
    title: 'NBA / NHL / MLB Playoffs',
    category: 'pro-sports',
    defaultTeam: 'lal',
    theme: makeTheme('#8b5cf6', '#f43f5e', '#6d28d9', '#1a1025', '#f5f3ff', '#ffffff'),
    entrants: [
      ['lal', 'Lakers', '🏆', ['#552583', '#fdb927', '#000000']],
      ['bos', 'Celtics', '🏆', ['#007a33', '#ffffff', '#000000']],
      ['gs', 'Warriors', '🏆', ['#1d428a', '#ffc72c', '#ffffff']],
      ['den', 'Nuggets', '🏆', ['#0e2240', '#fec524', '#1d428a']],
      ['mia', 'Heat', '🏆', ['#98002e', '#f9a01b', '#000000']],
      ['phi', '76ers', '🏆', ['#006bb6', '#ed174c', '#ffffff']],
      ['mil', 'Bucks', '🏆', ['#00471b', '#eee1c6', '#ffffff']],
      ['dal', 'Mavericks', '🏆', ['#00538c', '#b8c4ca', '#000000']],
      ['col', 'Avalanche', '🏆', ['#6f263d', '#236192', '#a2aaad']],
      ['edm', 'Oilers', '🏆', ['#041e42', '#ff4c00', '#ffffff']],
      ['nyr', 'Rangers', '🏆', ['#0033a0', '#c8102e', '#ffffff']],
      ['tb', 'Lightning', '🏆', ['#002868', '#ffffff', '#000000']],
      ['nyy', 'Yankees', '🏆', ['#003087', '#ffffff', '#e4002c']],
      ['lad', 'Dodgers', '🏆', ['#005a9c', '#ffffff', '#ef3e42']],
      ['houa', 'Astros', '🏆', ['#002d62', '#eb6e1f', '#ffffff']],
      ['atl', 'Braves', '🏆', ['#ce1141', '#13274f', '#ffffff']]
    ],
    stats: [['Points', '112', '108', 51], ['3-Pointers', '14', '11', 56], ['Rebounds', '42', '38', 53], ['Assists', '26', '22', 54], ['Steals', '8', '6', 57], ['FG%', '49%', '46%', 52]]
  },
  {
    id: 'tennis-grand-slams',
    title: 'Tennis Grand Slams',
    category: 'tennis',
    defaultTeam: 'alcaraz',
    theme: makeTheme('#10b981', '#f59e0b', '#047857', '#0f2c22', '#ecfdf5', '#ffffff'),
    entrants: [
      ['alcaraz', 'Alcaraz', '🎾', ['#ffffff', '#22c55e', '#15803d']],
      ['djok', 'Djokovic', '🎾', ['#1e3a8a', '#ffffff', '#1d4ed8']],
      ['sinner', 'Sinner', '🎾', ['#166534', '#ffffff', '#000000']],
      ['nadal', 'Nadal', '🎾', ['#dc2626', '#facc15', '#000000']],
      ['medv', 'Medvedev', '🎾', ['#ffffff', '#3b82f6', '#1e40af']],
      ['zverev', 'Zverev', '🎾', ['#facc15', '#000000', '#ffffff']],
      ['rune', 'Rune', '🎾', ['#ef4444', '#ffffff', '#000000']],
      ['tsits', 'Tsitsipas', '🎾', ['#0ea5e9', '#ffffff', '#000000']],
      ['swia', 'Swiatek', '🎾', ['#ec4899', '#ffffff', '#000000']],
      ['saba', 'Sabalenka', '🎾', ['#a855f7', '#ffffff', '#000000']],
      ['ryba', 'Rybakina', '🎾', ['#14b8a6', '#ffffff', '#000000']],
      ['gauff', 'Gauff', '🎾', ['#22c55e', '#ffffff', '#000000']],
      ['jabeu', 'Jabeur', '🎾', ['#f97316', '#ffffff', '#000000']],
      ['peg', 'Pegula', '🎾', ['#3b82f6', '#ffffff', '#000000']],
      ['vond', 'Vondrousova', '🎾', ['#eab308', '#ffffff', '#000000']],
      ['krejc', 'Krejcikova', '🎾', ['#ef4444', '#ffffff', '#000000']]
    ],
    stats: [['Aces', '12', '8', 60], ['Winners', '34', '28', 55], ['Unforced Errors', '18', '22', 55], ['Break Points', '4', '2', 67], ['First Serve %', '68%', '61%', 53], ['Net Points', '18', '12', 60]]
  },
  {
    id: 'esports-major',
    title: 'Esports Major',
    category: 'esports',
    defaultTeam: 't1',
    theme: makeTheme('#ec4899', '#6366f1', '#be185d', '#1e1b4b', '#fdf2f8', '#ffffff'),
    entrants: [
      ['t1', 'T1', '🎮', ['#e2012d', '#000000', '#ffffff']],
      ['g2', 'G2', '🎮', ['#000000', '#ffffff', '#c8102e']],
      ['fnc', 'Fnatic', '🎮', ['#ff5900', '#000000', '#ffffff']],
      ['tl', 'Team Liquid', '🎮', ['#0c2340', '#ffffff', '#00aeef']],
      ['navi', 'NAVI', '🎮', ['#ffee00', '#000000', '#ffffff']],
      ['vit', 'Vitality', '🎮', ['#f9e300', '#000000', '#ffffff']],
      ['c9', 'Cloud9', '🎮', ['#00aeef', '#ffffff', '#000000']],
      ['sen', 'Sentinels', '🎮', ['#ce0e2d', '#000000', '#ffffff']],
      ['gen', 'Gen.G', '🎮', ['#aa8a30', '#000000', '#ffffff']],
      ['blg', 'Bilibili', '🎮', ['#00a1d6', '#ffffff', '#000000']],
      ['faze', 'FaZe', '🎮', ['#ff0000', '#000000', '#ffffff']],
      ['og', 'OG', '🎮', ['#002b45', '#ffffff', '#000000']],
      ['eg', 'Evil Geniuses', '🎮', ['#0c1220', '#ffffff', '#d3af37']],
      ['100t', '100 Thieves', '🎮', ['#d31f3c', '#000000', '#ffffff']],
      ['tsm', 'TSM', '🎮', ['#000000', '#ffffff', '#c8102e']],
      ['koi', 'KOI', '🎮', ['#0d1b2a', '#ffffff', '#ff4d6d']]
    ],
    stats: [['Kills', '18', '14', 56], ['Deaths', '8', '11', 58], ['Assists', '42', '36', 54], ['Objectives', '7', '4', 64], ['Gold', '62k', '58k', 52], ['Vision Score', '88', '72', 55]]
  },
  {
    id: 'sailgp-companion',
    title: 'SailGP Companion',
    category: 'sailing',
    defaultTeam: 'aus',
    theme: makeTheme('#06b6d4', '#f43f5e', '#0e7490', '#082f49', '#ecfeff', '#ffffff'),
    entrants: [
      ['aus', 'Australia', '🇦🇺', ['#012169', '#ffcd00', '#00843d']],
      ['gbr', 'Great Britain', '🇬🇧', ['#ffffff', '#d41f35', '#1c3764']],
      ['nz', 'New Zealand', '🇳🇿', ['#00247d', '#ffffff', '#cc142b']],
      ['usa', 'United States', '🇺🇸', ['#ffffff', '#b31942', '#0a3161']],
      ['fra', 'France', '🇫🇷', ['#1d3d8f', '#ffffff', '#d84a3a']],
      ['den', 'Denmark', '🇩🇰', ['#c8102e', '#ffffff', '#000000']],
      ['jpn', 'Japan', '🇯🇵', ['#f6f6f6', '#d91f3c', '#0a2f68']],
      ['esp', 'Spain', '🇪🇸', ['#c60b1e', '#ffc400', '#75131a']],
      ['ger', 'Germany', '🇩🇪', ['#000000', '#dd0000', '#ffce00']],
      ['can', 'Canada', '🇨🇦', ['#ff0000', '#ffffff', '#8a1538']],
      ['sui', 'Switzerland', '🇨🇭', ['#d71920', '#ffffff', '#901019']],
      ['bra', 'Brazil', '🇧🇷', ['#139b49', '#ffd447', '#1b55a5']],
      ['ita', 'Italy', '🇮🇹', ['#009246', '#ffffff', '#ce2b37']],
      ['ned', 'Netherlands', '🇳🇱', ['#ae1c28', '#ffffff', '#21468b']],
      ['arg', 'Argentina', '🇦🇷', ['#75aadb', '#ffffff', '#f6b33f']],
      ['swe', 'Sweden', '🇸🇪', ['#006aa7', '#fecc00', '#0b4f7a']]
    ],
    stats: [['Top Speed', '96.4 kn', '94.1 kn', 52], ['Avg Speed', '42.1 kn', '40.8 kn', 51], ['Maneuvers', '14', '15', 48], ['Foiling %', '92%', '88%', 51], ['Distance', '7.2 nm', '7.1 nm', 51], ['Penalties', '0', '1', 67]]
  },
  {
    id: 'creator-reality-brackets',
    title: 'Reality / Creator Tournaments',
    category: 'creator',
    defaultTeam: 'alpha',
    theme: makeTheme('#d946ef', '#22c55e', '#a21caf', '#2a0a2e', '#fdf4ff', '#ffffff'),
    entrants: [
      ['alpha', 'Alpha Squad', '⭐', ['#d946ef', '#22c55e', '#ffffff']],
      ['beta', 'Beta House', '⭐', ['#22c55e', '#d946ef', '#ffffff']],
      ['gamma', 'Gamma Crew', '⭐', ['#f59e0b', '#ec4899', '#ffffff']],
      ['delta', 'Delta Fam', '⭐', ['#3b82f6', '#8b5cf6', '#ffffff']],
      ['echo', 'Echo Hive', '⭐', ['#ef4444', '#f97316', '#ffffff']],
      ['foxy', 'Foxy Clan', '⭐', ['#ec4899', '#f59e0b', '#ffffff']],
      ['ghost', 'Ghost Pack', '⭐', ['#64748b', '#94a3b8', '#ffffff']],
      ['hype', 'Hype House', '⭐', ['#8b5cf6', '#06b6d4', '#ffffff']],
      ['ivy', 'Ivy League', '⭐', ['#10b981', '#3b82f6', '#ffffff']],
      ['jolt', 'Jolt Squad', '⭐', ['#f43f5e', '#3b82f6', '#ffffff']],
      ['krew', 'Krew', '⭐', ['#eab308', '#ef4444', '#ffffff']],
      ['luxe', 'Luxe Life', '⭐', ['#ec4899', '#6366f1', '#ffffff']],
      ['muse', 'Muse Circle', '⭐', ['#06b6d4', '#d946ef', '#ffffff']],
      ['nova', 'Nova Crew', '⭐', ['#f97316', '#eab308', '#ffffff']],
      ['orbit', 'Orbit House', '⭐', ['#6366f1', '#22c55e', '#ffffff']],
      ['pulse', 'Pulse Fam', '⭐', ['#14b8a6', '#f43f5e', '#ffffff']]
    ],
    stats: [['Votes', '12.4k', '10.1k', 55], ['Clips', '86', '72', 54], ['Streams', '14', '11', 56], ['Challenges Won', '5', '3', 63], ['Fan Power', '9.2', '7.8', 54], ['Trending', '#2', '#5', 71]]
  },
  {
    id: 'awards-prediction-pools',
    title: 'Oscars / Grammys / Eurovision',
    category: 'awards',
    defaultTeam: 'oppen',
    theme: makeTheme('#f59e0b', '#ec4899', '#b45309', '#2a1a08', '#fffbeb', '#ffffff'),
    entrants: [
      ['oppen', 'Oppenheimer', '🎬', ['#000000', '#f59e0b', '#ffffff']],
      ['barb', 'Barbie', '🎬', ['#ec4899', '#f472b6', '#ffffff']],
      ['poor', 'Poor Things', '🎬', ['#10b981', '#f59e0b', '#ffffff']],
      ['kill', 'Killers of the Flower Moon', '🎬', ['#78350f', '#d97706', '#ffffff']],
      ['hold', 'Holdovers', '🎬', ['#3b82f6', '#facc15', '#ffffff']],
      ['past', 'Past Lives', '🎬', ['#f43f5e', '#fb7185', '#ffffff']],
      ['anat', 'Anatomy of a Fall', '🎬', ['#1e293b', '#94a3b8', '#ffffff']],
      ['zone', 'Zone of Interest', '🎬', ['#000000', '#ef4444', '#ffffff']],
      ['tayl', 'Taylor Swift', '🎵', ['#a855f7', '#e879f9', '#ffffff']],
      ['sza', 'SZA', '🎵', ['#22c55e', '#ffffff', '#000000']],
      ['bilal', 'Bilal Hassani', '🎵', ['#06b6d4', '#f472b6', '#ffffff']],
      ['lore', 'Loreen', '🎵', ['#f59e0b', '#000000', '#ffffff']],
      ['kaar', 'Käärijä', '🎵', ['#16a34a', '#000000', '#ffffff']],
      ['mahn', 'Mahmood', '🎵', ['#ef4444', '#10b981', '#ffffff']],
      ['corn', 'Cornelia Jakobs', '🎵', ['#3b82f6', '#facc15', '#ffffff']],
      ['samr', 'Sam Ryder', '🎵', ['#eab308', '#ec4899', '#ffffff']]
    ],
    stats: [['Noms', '13', '8', 62], ['Wins', '7', '4', 64], ['Critics Score', '94%', '89%', 51], ['Audience Score', '91%', '85%', 52], ['Box Office', '$950M', '$620M', 60], ['Campaign Spend', '$42M', '$28M', 60]]
  },
  {
    id: 'local-leagues',
    title: 'School / Office / Pub / Rec Sports',
    category: 'local',
    defaultTeam: 'phoenix',
    theme: makeTheme('#22c55e', '#3b82f6', '#15803d', '#0f291e', '#f0fdf4', '#ffffff'),
    entrants: [
      ['phoenix', 'Phoenix FC', '⚽', ['#ef4444', '#f97316', '#ffffff']],
      ['titan', 'Titan United', '⚽', ['#3b82f6', '#1d4ed8', '#ffffff']],
      ['rover', 'Rovers', '⚽', ['#22c55e', '#15803d', '#ffffff']],
      ['sting', 'Stingers', '⚽', ['#eab308', '#ca8a04', '#ffffff']],
      ['thund', 'Thunder', '⚽', ['#a855f7', '#7e22ce', '#ffffff']],
      ['shark', 'Sharks', '⚽', ['#06b6d4', '#0891b2', '#ffffff']],
      ['vultu', 'Vultures', '⚽', ['#f43f5e', '#be123c', '#ffffff']],
      ['panda', 'Pandas', '⚽', ['#10b981', '#047857', '#ffffff']],
      ['eagle', 'Eagles', '🏈', ['#1e3a8a', '#facc15', '#ffffff']],
      ['lion', 'Lions', '🏈', ['#c2410c', '#fdba74', '#ffffff']],
      ['hawk', 'Hawks', '🏀', ['#7c3aed', '#c4b5fd', '#ffffff']],
      ['blaze', 'Blazers', '🏀', ['#dc2626', '#fca5a5', '#ffffff']],
      ['orca', 'Orcas', '🏐', ['#0e7490', '#67e8f9', '#ffffff']],
      ['cobra', 'Cobras', '🏐', ['#15803d', '#86efac', '#ffffff']],
      ['falcon', 'Falcons', '🥎', ['#b45309', '#fcd34d', '#ffffff']],
      ['wolf', 'Wolves', '🥎', ['#4b5563', '#9ca3af', '#ffffff']]
    ],
    stats: [['Goals', '3', '2', 60], ['Shots', '14', '10', 58], ['Saves', '5', '4', 56], ['Possession', '56%', '44%', 56], ['Fouls', '8', '11', 42], ['Corners', '6', '3', 67]]
  }
]

function buildBracket (entrants, fitId) {
  const teams = entrants.map(([id, name, flag, colors]) => ({ id, name, flag, colors }))
  const round32Matches = []
  for (let i = 0; i < 8; i++) {
    round32Matches.push({
      id: `r32-${i + 1}`,
      time: 'Round of 16',
      status: 'Open',
      slots: [teams[i * 2].id, teams[i * 2 + 1].id],
      score: [null, null]
    })
  }
  const bracketLinks = [
    { from: ['r32-1', 'r32-2'], to: 'r16-1' },
    { from: ['r32-3', 'r32-4'], to: 'r16-2' },
    { from: ['r32-5', 'r32-6'], to: 'r16-3' },
    { from: ['r32-7', 'r32-8'], to: 'r16-4' },
    { from: ['r16-1', 'r16-2'], to: 'qf-1' },
    { from: ['r16-3', 'r16-4'], to: 'qf-2' },
    { from: ['qf-1', 'qf-2'], to: 'sf-1' },
    { from: ['sf-1'], to: 'final-1' }
  ]
  const bracketMatchIds = [
    ...round32Matches.map(m => m.id),
    'r16-1', 'r16-2', 'r16-3', 'r16-4',
    'qf-1', 'qf-2',
    'sf-1',
    'final-1'
  ]
  const homeFixtures = round32Matches.slice(0, 3).map(m => {
    const a = teams.find(t => t.id === m.slots[0])
    const b = teams.find(t => t.id === m.slots[1])
    return {
      status: 'Today',
      title: `${a.name} vs ${b.name}`,
      detail: 'Round of 16 match room',
      live: m.id === 'r32-1'
    }
  })
  const leaders = [
    { user: 'lina', team: teams[0].id, score: '6/8', prize: '$540' },
    { user: 'amara', team: teams[2].id, score: '5/8', prize: '$360' },
    { user: 'vera', team: teams[1].id, score: '5/8', prize: '$270' },
    { user: 'diego', team: teams[4].id, score: '4/8', prize: '$195' },
    { user: 'milo', team: teams[6].id, score: '4/8', prize: '$140' },
    { user: 'kenji', team: teams[3].id, score: '3/8', prize: '$95' }
  ]
  const gameLeaderboardRows = [
    { user: 'captain', team: teams[0].id, record: '4-1', trust: '99.2%' },
    { user: 'freya', team: teams[2].id, record: '4-1', trust: '98.9%' },
    { user: 'vera', team: teams[1].id, record: '3-2', trust: '98.7%' },
    { user: 'kwame', team: teams[5].id, record: '3-2', trust: '98.1%' },
    { user: 'milo', team: teams[4].id, record: '3-2', trust: '97.9%' }
  ]
  const gameRounds = [
    { shooter: 'captain', shooterTeam: teams[0].id, keeper: 'vera', keeperTeam: teams[1].id, aim: 'right-high', dive: 'right-high', power: 3, curve: 1, releaseTick: 42, keeperTick: 43 },
    { shooter: 'vera', shooterTeam: teams[1].id, keeper: 'captain', keeperTeam: teams[0].id, aim: 'left-low', dive: 'center-low', power: 4, curve: -1, releaseTick: 39, keeperTick: 41 },
    { shooter: 'captain', shooterTeam: teams[0].id, keeper: 'milo', keeperTeam: teams[4].id, aim: 'center-high', dive: 'left-high', power: 4, curve: 2, releaseTick: 45, keeperTick: 44 }
  ]
  const commentary = {
    EN: [
      ['Today', `${teams[0].name} vs ${teams[1].name} is the next Round of 16 room. Picks are open until kickoff.`],
      ['Next', `${teams[2].name} vs ${teams[3].name} follows later today.`],
      ['Bracket', 'Pool impact is live, but the fallback feed will not invent results before they happen.']
    ],
    PT: [
      ['Today', `${teams[0].name} vs ${teams[1].name} e a proxima sala. Palpites abertos ate o inicio.`],
      ['Next', `${teams[2].name} vs ${teams[3].name} vem depois.`],
      ['Bracket', 'O impacto do bolao esta ativo, mas o fallback nao inventa resultados.']
    ],
    ES: [
      ['Today', `${teams[0].name} vs ${teams[1].name} es la proxima sala. Picks abiertos hasta el inicio.`],
      ['Next', `${teams[2].name} vs ${teams[3].name} sigue mas tarde.`],
      ['Bracket', 'El impacto del pool esta activo, pero el fallback no inventa resultados.']
    ],
    FR: [
      ['Today', `${teams[0].name} vs ${teams[1].name} est la prochaine salle. Picks ouverts jusqu au coup d envoi.`],
      ['Next', `${teams[2].name} vs ${teams[3].name} suit ensuite.`],
      ['Bracket', 'L impact du pool est actif, mais le fallback ne fabrique pas de resultats.']
    ]
  }
  const defaultChat = [
    { user: 'lina', text: `${teams[0].name}/${teams[1].name} room is up. No fake result until the feed lands.`, time: 'Today' },
    { user: 'vera', text: `${teams[2].name}/${teams[3].name} pool is next on my list.`, time: 'Next' },
    { user: 'ash', text: 'Bracket is still Round of 16.', time: 'R16' }
  ]
  return {
    teams,
    round32Matches,
    bracketLinks,
    bracketMatchIds,
    homeFixtures,
    leaders,
    gameLeaderboardRows,
    gameRounds,
    commentary,
    defaultChat
  }
}

function poolsForFit (fitId) {
  const base = [
    { tier: 10, entrants: 92, closes: '12h', max: 256, prize: '$920', heat: 'Open', rail: 'USDT demo' },
    { tier: 25, entrants: 58, closes: '9h', max: 160, prize: '$1,450', heat: 'Hot', rail: 'USDT demo' },
    { tier: 50, entrants: 32, closes: '7h', max: 96, prize: '$1,600', heat: 'Sharp', rail: 'USDT demo' },
    { tier: 100, entrants: 16, closes: '5h', max: 64, prize: '$1,600', heat: 'Elite', rail: 'USDT demo' }
  ]
  return base
}

const ENTRANT_SHAPES = {
  'euros-copa-america': 'team',
  'champions-league-knockout': 'team',
  'march-madness': 'team',
  'pro-playoffs': 'team',
  'tennis-grand-slams': 'player',
  'esports-major': 'team',
  'sailgp-companion': 'team',
  'creator-reality-brackets': 'creator',
  'awards-prediction-pools': 'nominee',
  'local-leagues': 'team'
}

function buildFixtureConfig (fit) {
  const data = buildBracket(fit.entrants, fit.id)
  const liveMatch = data.homeFixtures.find(f => f.live) || data.homeFixtures[0]
  return {
    fitId: fit.id,
    title: fit.title,
    subtitle: 'Ultimate Sports',
    category: fit.category,
    entrantShape: ENTRANT_SHAPES[fit.id] || 'team',
    defaultTeam: fit.defaultTeam,
    theme: fit.theme,
    entrants: data.teams,
    teams: data.teams,
    fixtures: data.homeFixtures,
    homeFixtures: data.homeFixtures,
    round32Matches: data.round32Matches,
    bracketLinks: data.bracketLinks,
    bracketMatchIds: data.bracketMatchIds,
    liveMatch,
    pools: poolsForFit(fit.id),
    matchStats: fit.stats,
    leaders: data.leaders,
    commentary: data.commentary,
    defaultChat: data.defaultChat,
    gameRounds: data.gameRounds,
    gameLeaderboardRows: data.gameLeaderboardRows,
    assets: { heroBackdrop: '../generated/fit-heroes/' + fit.id + '.svg' }
  }
}

function serializeJsValue (value, indent = 2) {
  return JSON.stringify(value, null, indent)
}

const genericLines = [
  "// Generic themed fits for all non-MMA, non-World-Cup event shapes.",
  "// Generated by scripts/generate-generic-fit-data.js",
  "(function (root) {",
  "  'use strict'",
  "",
  "  function makeTheme (primary, secondary, accent, ink, soft, surface) {",
  "    return {",
  "      '--ink': ink || '#4a3b57',",
  "      '--muted': '#a897b3',",
  "      '--soft': soft || '#fff0f8',",
  "      '--surface': surface || '#ffffff',",
  "      '--surface-2': '#fdf5fb',",
  "      '--surface-3': '#f6eeff',",
  "      '--line': '#ffd9ee',",
  "      '--line-strong': '#f3c8e2',",
  "      '--green': primary,",
  "      '--green-deep': accent,",
  "      '--red': secondary,",
  "      '--pink': secondary,",
  "      '--pink-deep': accent,",
  "      '--blue': '#7cc4ff',",
  "      '--blue-deep': '#3a90dd',",
  "      '--grape': '#b79bff',",
  "      '--gold': '#f0b93f',",
  "      '--lemon': '#ffd76b'",
  "    }",
  "  }",
  ""
]

const fixtureConfigs = fits.map(buildFixtureConfig)

fixtureConfigs.forEach(cfg => {
  const dataVar = `${cfg.fitId.replace(/-/g, '_')}_data`
  genericLines.push(`  // ${cfg.title}`)
  genericLines.push(`  const ${dataVar} = (function () {`)
  genericLines.push(`    const teams = ${JSON.stringify(cfg.teams)}`)
  genericLines.push(`    const round32Matches = ${JSON.stringify(cfg.round32Matches)}`)
  genericLines.push(`    const bracketLinks = ${JSON.stringify(cfg.bracketLinks)}`)
  genericLines.push(`    const bracketMatchIds = ${JSON.stringify(cfg.bracketMatchIds)}`)
  genericLines.push(`    const homeFixtures = ${JSON.stringify(cfg.homeFixtures)}`)
  genericLines.push(`    const leaders = ${JSON.stringify(cfg.leaders)}`)
  genericLines.push(`    const gameLeaderboardRows = ${JSON.stringify(cfg.gameLeaderboardRows)}`)
  genericLines.push(`    const gameRounds = ${JSON.stringify(cfg.gameRounds)}`)
  genericLines.push(`    const commentary = ${JSON.stringify(cfg.commentary)}`)
  genericLines.push(`    const defaultChat = ${JSON.stringify(cfg.defaultChat)}`)
  genericLines.push(`    return { teams, round32Matches, bracketLinks, bracketMatchIds, homeFixtures, leaders, gameLeaderboardRows, gameRounds, commentary, defaultChat }`)
  genericLines.push(`  })()`)
  genericLines.push(``)
})

genericLines.push(`  const fits = [`)
fixtureConfigs.forEach(cfg => {
  const dataVar = `${cfg.fitId.replace(/-/g, '_')}_data`
  genericLines.push(`    {`)
  genericLines.push(`      id: '${cfg.fitId}',`)
  genericLines.push(`      title: '${cfg.title}',`)
  genericLines.push(`      category: '${cfg.category}',`)
  genericLines.push(`      entrantShape: '${cfg.entrantShape}',`)
  genericLines.push(`      defaultTeam: '${cfg.defaultTeam}',`)
  genericLines.push(`      theme: makeTheme('${cfg.theme['--green']}', '${cfg.theme['--red']}', '${cfg.theme['--green-deep']}', '${cfg.theme['--ink']}', '${cfg.theme['--soft']}', '${cfg.theme['--surface']}'),`)
  genericLines.push(`      data: ${dataVar}`)
  genericLines.push(`    },`)
})
genericLines.push(`  ]`)
genericLines.push(``)
genericLines.push(`  fits.forEach(fit => {`)
genericLines.push(`    const liveMatch = fit.data.homeFixtures.find(f => f.live) || fit.data.homeFixtures[0]`)
genericLines.push(`    root.registerFit(fit.id, {`)
genericLines.push(`      fitId: fit.id,`)
genericLines.push(`      title: fit.title,`)
genericLines.push(`      subtitle: 'Ultimate Sports',`)
genericLines.push(`      category: fit.category,`)
genericLines.push(`      entrantShape: fit.entrantShape,`)
genericLines.push(`      defaultTeam: fit.defaultTeam,`)
genericLines.push(`      theme: fit.theme,`)
genericLines.push(`      entrants: fit.data.teams,`)
genericLines.push(`      teams: fit.data.teams,`)
genericLines.push(`      fixtures: fit.data.homeFixtures,`)
genericLines.push(`      homeFixtures: fit.data.homeFixtures,`)
genericLines.push(`      round32Matches: fit.data.round32Matches,`)
genericLines.push(`      bracketLinks: fit.data.bracketLinks,`)
genericLines.push(`      bracketMatchIds: fit.data.bracketMatchIds,`)
genericLines.push(`      liveMatch,`)
genericLines.push(`      pools: [{ tier: 10, entrants: 92, closes: '12h', max: 256, prize: '$920', heat: 'Open', rail: 'USDT demo' }, { tier: 25, entrants: 58, closes: '9h', max: 160, prize: '$1,450', heat: 'Hot', rail: 'USDT demo' }, { tier: 50, entrants: 32, closes: '7h', max: 96, prize: '$1,600', heat: 'Sharp', rail: 'USDT demo' }, { tier: 100, entrants: 16, closes: '5h', max: 64, prize: '$1,600', heat: 'Elite', rail: 'USDT demo' }],`)
genericLines.push(`      matchStats: fit.stats,`)
genericLines.push(`      leaders: fit.data.leaders,`)
genericLines.push(`      commentary: fit.data.commentary,`)
genericLines.push(`      defaultChat: fit.data.defaultChat,`)
genericLines.push(`      gameRounds: fit.data.gameRounds,`)
genericLines.push(`      gameLeaderboardRows: fit.data.gameLeaderboardRows,`)
genericLines.push(`      assets: { heroBackdrop: '../generated/fit-heroes/' + fit.id + '.svg' },`)
genericLines.push(`    })`)
genericLines.push(`  })`)
genericLines.push(`})(window)`)
genericLines.push(``)

fs.writeFileSync(OUT_FILE, genericLines.join('\n') + '\n')
console.log(`Wrote ${OUT_FILE}`)

fs.mkdirSync(FIXTURES_DIR, { recursive: true })

fixtureConfigs.forEach(cfg => {
  const fixtureFile = path.join(FIXTURES_DIR, `${cfg.fitId}.js`)
  const cfgClone = { ...cfg }
  delete cfgClone.entrants
  delete cfgClone.fixtures
  const fixtureLines = [
    `// ${cfg.title} fixture`,
    `(function (root) {`,
    `  'use strict'`,
    ``,
    `  const cfg = ${serializeJsValue(cfgClone, 2)}`,
    ``,
    `  cfg.entrants = cfg.teams`,
    `  cfg.fixtures = cfg.homeFixtures`,
    ``,
    `  if (typeof root !== 'undefined' && typeof root.registerFit === 'function') {`,
    `    root.registerFit(cfg.fitId, cfg)`,
    `  }`,
    ``,
    `  if (typeof module !== 'undefined' && module.exports) {`,
    `    module.exports = cfg`,
    `  }`,
    `})(typeof window !== 'undefined' ? window : globalThis)`,
    ``
  ]
  fs.writeFileSync(fixtureFile, fixtureLines.join('\n'))
  console.log(`Wrote ${fixtureFile}`)
})
