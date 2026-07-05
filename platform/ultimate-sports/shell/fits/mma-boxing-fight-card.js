// MMA / Boxing / Combat sports fight-card fit.
(function (root) {
  'use strict'

  const red = '#ef4444'
  const blue = '#3b82f6'
  const gold = '#f59e0b'
  const dark = '#121214'
  const surface = '#1a1a1d'

  const teams = [
    { id: 'silva', name: 'R. Silva', flag: '🇧🇷', colors: [red, '#7f1d1d', '#fee2e2'] },
    { id: 'jones', name: 'D. Jones', flag: '🇺🇸', colors: [blue, '#1e3a8a', '#dbeafe'] },
    { id: 'nunes', name: 'A. Nunes', flag: '🇧🇷', colors: [red, '#7f1d1d', '#fee2e2'] },
    { id: 'shevchenko', name: 'V. Shevchenko', name: 'V. Shevchenko', flag: '🇰🇬', colors: [blue, '#1e3a8a', '#dbeafe'] },
    { id: 'oliveira', name: 'C. Oliveira', flag: '🇧🇷', colors: [red, '#7f1d1d', '#fee2e2'] },
    { id: 'dariush', name: 'B. Dariush', flag: '🇮🇷', colors: [blue, '#1e3a8a', '#dbeafe'] },
    { id: 'sterling', name: 'C. Sterling', flag: '🇯🇲', colors: [red, '#7f1d1d', '#fee2e2'] },
    { id: 'omalley', name: 'S. O\'Malley', flag: '🇺🇸', colors: [blue, '#1e3a8a', '#dbeafe'] },
    { id: 'volkanovski', name: 'A. Volkanovski', flag: '🇦🇺', colors: [red, '#7f1d1d', '#fee2e2'] },
    { id: 'makhachev', name: 'I. Makhachev', flag: '🇷🇺', colors: [blue, '#1e3a8a', '#dbeafe'] },
    { id: 'pereira', name: 'A. Pereira', flag: '🇧🇷', colors: [red, '#7f1d1d', '#fee2e2'] },
    { id: 'adesanya', name: 'I. Adesanya', flag: '🇳🇬', colors: [blue, '#1e3a8a', '#dbeafe'] },
    { id: 'edwards', name: 'L. Edwards', flag: '🇬🇧', colors: [red, '#7f1d1d', '#fee2e2'] },
    { id: 'usman', name: 'K. Usman', flag: '🇳🇬', colors: [blue, '#1e3a8a', '#dbeafe'] },
    { id: 'prochazka', name: 'J. Procházka', flag: '🇨🇿', colors: [red, '#7f1d1d', '#fee2e2'] },
    { id: 'teixeira', name: 'G. Teixeira', flag: '🇧🇷', colors: [blue, '#1e3a8a', '#dbeafe'] }
  ]

  const round32Matches = [
    { id: 'r32-1', time: 'Main', status: 'Open', slots: ['silva', 'jones'], score: [null, null] },
    { id: 'r32-2', time: 'Co-main', status: 'Open', slots: ['nunes', 'shevchenko'], score: [null, null] },
    { id: 'r32-3', time: 'Card', status: 'Open', slots: ['oliveira', 'dariush'], score: [null, null] },
    { id: 'r32-4', time: 'Card', status: 'Open', slots: ['sterling', 'omalley'], score: [null, null] },
    { id: 'r32-5', time: 'Card', status: 'Open', slots: ['volkanovski', 'makhachev'], score: [null, null] },
    { id: 'r32-6', time: 'Card', status: 'Open', slots: ['pereira', 'adesanya'], score: [null, null] },
    { id: 'r32-7', time: 'Card', status: 'Open', slots: ['edwards', 'usman'], score: [null, null] },
    { id: 'r32-8', time: 'Card', status: 'Open', slots: ['prochazka', 'teixeira'], score: [null, null] }
  ]

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
    'r32-1', 'r32-2', 'r32-3', 'r32-4', 'r32-5', 'r32-6', 'r32-7', 'r32-8',
    'r16-1', 'r16-2', 'r16-3', 'r16-4',
    'qf-1', 'qf-2',
    'sf-1',
    'final-1'
  ]

  const pools = [
    { tier: 10, entrants: 86, closes: '12h', max: 256, prize: '$860', heat: 'Open', rail: 'USDT demo' },
    { tier: 25, entrants: 54, closes: '9h', max: 160, prize: '$1,350', heat: 'Hot', rail: 'USDT demo' },
    { tier: 50, entrants: 28, closes: '7h', max: 96, prize: '$1,400', heat: 'Sharp', rail: 'USDT demo' },
    { tier: 100, entrants: 14, closes: '5h', max: 64, prize: '$1,400', heat: 'Elite', rail: 'USDT demo' }
  ]

  const homeFixtures = [
    { status: 'Main event', title: 'Silva vs Jones', detail: 'Light Heavyweight title pool', live: true },
    { status: 'Co-main', title: 'Nunes vs Shevchenko', detail: '$50 pool closing', live: true },
    { status: 'Featured', title: 'Oliveira vs Dariush', detail: 'Lightweight bracket room', live: false }
  ]

  const matchStats = [
    ['Strikes landed', '112', '89', 56],
    ['Takedowns', '3', '1', 75],
    ['Control time', '4:12', '2:08', 66],
    ['Knockdowns', '1', '0', 100],
    ['Submission attempts', '2', '1', 67],
    ['Significant strikes', '78', '61', 56]
  ]

  const leaders = [
    { user: 'lina', team: 'silva', score: '7/8', prize: '$620' },
    { user: 'amara', team: 'nunes', score: '6/8', prize: '$410' },
    { user: 'vera', team: 'jones', score: '6/8', prize: '$305' },
    { user: 'diego', team: 'oliveira', score: '5/8', prize: '$220' },
    { user: 'milo', team: 'adesanya', score: '5/8', prize: '$160' },
    { user: 'kenji', team: 'makhachev', score: '4/8', prize: '$110' }
  ]

  const commentary = {
    EN: [
      ['Main', 'Silva vs Jones is the main event room. Picks are open until the walkouts.'],
      ['Co-main', 'Nunes vs Shevchenko follows on the main card.'],
      ['Prelims', 'The early prelims start with Sterling vs O\'Malley.']
    ],
    PT: [
      ['Main', 'Silva vs Jones é a sala do evento principal. Palpites abertos até a entrada.'],
      ['Co-main', 'Nunes vs Shevchenko vem depois no card principal.'],
      ['Prelims', 'As preliminares começam com Sterling vs O\'Malley.']
    ],
    ES: [
      ['Main', 'Silva vs Jones es la sala del evento estelar. Picks abiertos hasta la salida.'],
      ['Co-main', 'Nunes vs Shevchenko sigue en la cartelera principal.'],
      ['Prelims', 'Las preliminares comienzan con Sterling vs O\'Malley.']
    ],
    FR: [
      ['Main', 'Silva vs Jones est la salle de l\'événement principal. Picks ouverts jusqu\'à l\'entrée.'],
      ['Co-main', 'Nunes vs Shevchenko suit sur la carte principale.'],
      ['Prelims', 'Les préliminaires commencent avec Sterling vs O\'Malley.']
    ]
  }

  const defaultChat = [
    { user: 'lina', text: 'Silva/Jones room is up. No fake result until the fight lands.', time: 'Main' },
    { user: 'vera', text: 'Nunes/Shevchenko pool is next on my list.', time: 'Co-main' },
    { user: 'ash', text: 'Main card bracket is live.', time: 'Card' }
  ]

  const gameRounds = [
    { shooter: 'captain', shooterTeam: 'silva', keeper: 'vera', keeperTeam: 'jones', aim: 'right-high', dive: 'right-high', power: 3, curve: 1, releaseTick: 42, keeperTick: 43 },
    { shooter: 'vera', shooterTeam: 'jones', keeper: 'captain', keeperTeam: 'silva', aim: 'left-low', dive: 'center-low', power: 4, curve: -1, releaseTick: 39, keeperTick: 41 },
    { shooter: 'captain', shooterTeam: 'silva', keeper: 'milo', keeperTeam: 'adesanya', aim: 'center-high', dive: 'left-high', power: 4, curve: 2, releaseTick: 45, keeperTick: 44 }
  ]

  const gameLeaderboardRows = [
    { user: 'captain', team: 'silva', record: '4-1', trust: '99.2%' },
    { user: 'freya', team: 'nunes', record: '4-1', trust: '98.9%' },
    { user: 'vera', team: 'jones', record: '3-2', trust: '98.7%' },
    { user: 'kwame', team: 'oliveira', record: '3-2', trust: '98.1%' },
    { user: 'milo', team: 'adesanya', record: '3-2', trust: '97.9%' }
  ]

  const bouts = round32Matches.map((m, i) => {
    const redCorner = teams.find(t => t.id === m.slots[0])
    const blueCorner = teams.find(t => t.id === m.slots[1])
    const labels = ['Main event', 'Co-main', 'Featured', 'Featured', 'Prelim', 'Prelim', 'Prelim', 'Prelim']
    const weights = ['Light Heavyweight', 'Women\'s Bantamweight', 'Lightweight', 'Bantamweight', 'Featherweight', 'Middleweight', 'Welterweight', 'Light Heavyweight']
    return {
      id: m.id,
      label: labels[i],
      weightClass: weights[i],
      status: m.status,
      red: m.slots[0],
      blue: m.slots[1],
      redRecord: `${[12, 10, 11, 9, 14, 8, 13, 7][i]}-${[3, 2, 4, 3, 2, 5, 3, 4][i]}-${[0, 1, 0, 1, 0, 1, 0, 0][i]}`,
      blueRecord: `${[10, 12, 9, 11, 8, 14, 7, 13][i]}-${[2, 3, 3, 4, 4, 2, 5, 3][i]}-${[1, 0, 1, 0, 1, 0, 0, 1][i]}`,
      method: ['KO/TKO', 'Submission', 'Decision', 'Decision'][i % 4],
      round: [1, 2, 3, 3][i % 4]
    }
  })

  root.registerFit('mma-boxing-fight-card', {
    fitId: 'mma-boxing-fight-card',
    title: 'Combat Sport Fight Cards',
    subtitle: 'Ultimate Sports',
    category: 'combat-sports',
    entrantShape: 'player',
    templateKinds: ['fight-card'],
    defaultTeam: 'silva',
    background: '#121214',
    theme: {
      '--ink': '#f4f4f4',
      '--muted': '#a0a0a0',
      '--soft': '#121214',
      '--surface': '#1a1a1d',
      '--surface-2': '#202024',
      '--surface-3': '#27272c',
      '--line': '#3a3a3e',
      '--line-strong': '#55555a',
      '--green': '#14b8a6',
      '--green-deep': '#0f766e',
      '--red': '#ef4444',
      '--pink': '#f87171',
      '--pink-deep': '#b91c1c',
      '--blue': '#3b82f6',
      '--blue-deep': '#1d4ed8',
      '--grape': '#a855f7',
      '--gold': '#f59e0b',
      '--lemon': '#fbbf24'
    },
    teams,
    pools,
    round32Matches,
    bracketLinks,
    bracketMatchIds,
    homeFixtures,
    matchStats,
    leaders,
    commentary,
    defaultChat,
    gameRounds,
    gameLeaderboardRows,
    templateData: { bouts },
    assets: {
      heroBackdrop: '../generated/mma-card/hero-backdrop/wide.png'
    }
  })
})(window)
