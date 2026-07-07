// World Cup — canonical kawaii fit with a full data kit.
(function (root) {
  'use strict'

  const teams = [
    { id: 'br', name: 'Brazil', flag: '🇧🇷', colors: ['#139b49', '#ffd447', '#1b55a5'] },
    { id: 'ar', name: 'Argentina', flag: '🇦🇷', colors: ['#75aadb', '#ffffff', '#f6b33f'] },
    { id: 'fr', name: 'France', flag: '🇫🇷', colors: ['#1d3d8f', '#ffffff', '#d84a3a'] },
    { id: 'es', name: 'Spain', flag: '🇪🇸', colors: ['#c60b1e', '#ffc400', '#75131a'] },
    { id: 'eng', name: 'England', flag: '🏴', colors: ['#ffffff', '#d41f35', '#1c3764'] },
    { id: 'de', name: 'Germany', flag: '🇩🇪', colors: ['#000000', '#dd0000', '#ffce00'] },
    { id: 'pt', name: 'Portugal', flag: '🇵🇹', colors: ['#d71920', '#006b3f', '#f6c343'] },
    { id: 'nl', name: 'Netherlands', flag: '🇳🇱', colors: ['#ae1c28', '#ffffff', '#21468b'] },
    { id: 'it', name: 'Italy', flag: '🇮🇹', colors: ['#009246', '#ffffff', '#ce2b37'] },
    { id: 'be', name: 'Belgium', flag: '🇧🇪', colors: ['#000000', '#fae042', '#ed2939'] },
    { id: 'hr', name: 'Croatia', flag: '🇭🇷', colors: ['#ff0000', '#ffffff', '#171796'] },
    { id: 'uy', name: 'Uruguay', flag: '🇺🇾', colors: ['#ffffff', '#0038a8', '#000000'] },
    { id: 'mx', name: 'Mexico', flag: '🇲🇽', colors: ['#0c8c57', '#ffffff', '#d43f3a'] },
    { id: 'us', name: 'United States', flag: '🇺🇸', colors: ['#ffffff', '#b31942', '#0a3161'] },
    { id: 'jp', name: 'Japan', flag: '🇯🇵', colors: ['#f6f6f6', '#d91f3c', '#0a2f68'] },
    { id: 'kr', name: 'South Korea', flag: '🇰🇷', colors: ['#ffffff', '#c60c2f', '#003478'] }
  ]

  const round32Matches = [
    { id: 'r32-1', time: 'Round of 16', status: 'Open', slots: ['br', 'kr'], score: [null, null] },
    { id: 'r32-2', time: 'Round of 16', status: 'Open', slots: ['jp', 'hr'], score: [null, null] },
    { id: 'r32-3', time: 'Round of 16', status: 'Open', slots: ['ar', 'nl'], score: [null, null] },
    { id: 'r32-4', time: 'Round of 16', status: 'Open', slots: ['us', 'uy'], score: [null, null] },
    { id: 'r32-5', time: 'Round of 16', status: 'Open', slots: ['fr', 'mx'], score: [null, null] },
    { id: 'r32-6', time: 'Round of 16', status: 'Open', slots: ['eng', 'be'], score: [null, null] },
    { id: 'r32-7', time: 'Round of 16', status: 'Open', slots: ['it', 'es'], score: [null, null] },
    { id: 'r32-8', time: 'Round of 16', status: 'Open', slots: ['pt', 'de'], score: [null, null] }
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
    { tier: 10, entrants: 128, closes: '12h', max: 256, prize: '$1,280', heat: 'Open', rail: 'USDT demo' },
    { tier: 25, entrants: 84, closes: '9h', max: 160, prize: '$2,100', heat: 'Hot', rail: 'USDT demo' },
    { tier: 50, entrants: 48, closes: '7h', max: 96, prize: '$2,400', heat: 'Sharp', rail: 'USDT demo' },
    { tier: 100, entrants: 24, closes: '5h', max: 64, prize: '$2,400', heat: 'Elite', rail: 'USDT demo' }
  ]

  const homeFixtures = [
    { status: 'Today', title: 'Brazil vs South Korea', detail: 'Round of 16 match room', live: true },
    { status: 'Today', title: 'Japan vs Croatia', detail: 'Round of 16 match room', live: false },
    { status: 'Tomorrow', title: 'Argentina vs Australia', detail: 'Round of 16 match room', live: false }
  ]

  const matchStats = [
    ['Possession', '58%', '42%', 58],
    ['Shots', '14', '6', 70],
    ['xG', '2.10', '0.74', 74],
    ['Pass accuracy', '89%', '81%', 62],
    ['Corners', '6', '2', 75],
    ['Saves', '1', '4', 20]
  ]

  const leaders = [
    { user: 'lina', team: 'br', score: '12/15', prize: '$812' },
    { user: 'amara', team: 'ar', score: '12/15', prize: '$540' },
    { user: 'vera', team: 'fr', score: '11/15', prize: '$410' },
    { user: 'diego', team: 'es', score: '11/15', prize: '$305' },
    { user: 'milo', team: 'eng', score: '10/15', prize: '$190' },
    { user: 'kenji', team: 'de', score: '10/15', prize: '$120' }
  ]

  const gameRounds = [
    { shooter: 'captain', shooterTeam: 'br', keeper: 'vera', keeperTeam: 'ar', aim: 'right-high', dive: 'right-high', power: 3, curve: 1, releaseTick: 42, keeperTick: 43 },
    { shooter: 'vera', shooterTeam: 'ar', keeper: 'captain', keeperTeam: 'br', aim: 'left-low', dive: 'center-low', power: 4, curve: -1, releaseTick: 39, keeperTick: 41 },
    { shooter: 'captain', shooterTeam: 'br', keeper: 'milo', keeperTeam: 'fr', aim: 'center-high', dive: 'left-high', power: 4, curve: 2, releaseTick: 45, keeperTick: 44 }
  ]

  const gameLeaderboardRows = [
    { user: 'captain', team: 'br', record: '4-1', trust: '99.2%' },
    { user: 'freya', team: 'ar', record: '4-1', trust: '98.9%' },
    { user: 'vera', team: 'fr', record: '3-2', trust: '98.7%' },
    { user: 'kwame', team: 'es', record: '3-2', trust: '98.1%' },
    { user: 'milo', team: 'eng', record: '3-2', trust: '97.9%' }
  ]

  const commentary = {
    EN: [
      ['Today', 'Brazil vs South Korea is the next Round of 16 room. Picks are open until kickoff.'],
      ['Next', 'Japan vs Croatia follows later today.'],
      ['Bracket', 'Pool impact is live, but the fallback feed will not invent results before they happen.']
    ],
    PT: [
      ['Today', 'Brasil vs Coreia do Sul e a proxima sala. Palpites abertos ate o inicio.'],
      ['Next', 'Japao vs Croacia vem depois.'],
      ['Bracket', 'O impacto do bolao esta ativo, mas o fallback nao inventa resultados.']
    ],
    ES: [
      ['Today', 'Brasil vs Corea del Sur es la proxima sala. Picks abiertos hasta el inicio.'],
      ['Next', 'Japon vs Croacia sigue mas tarde.'],
      ['Bracket', 'El impacto del pool esta activo, pero el fallback no inventa resultados.']
    ],
    FR: [
      ['Today', 'Bresil vs Coree du Sud est la prochaine salle. Picks ouverts jusqu au coup d envoi.'],
      ['Next', 'Japon vs Croatie suit ensuite.'],
      ['Bracket', "L impact du pool est actif, mais le fallback ne fabrique pas de resultats."]
    ]
  }

  const defaultChat = [
    { user: 'lina', text: 'Brazil/Korea room is up. No fake result until the feed lands.', time: 'Today' },
    { user: 'vera', text: 'Japan/Croatia pool is next on my list.', time: 'Next' },
    { user: 'ash', text: 'Bracket is still Round of 16.', time: 'R16' }
  ]

  root.registerFit('world-cup', {
    fitId: 'world-cup',
    title: 'World Cup',
    subtitle: 'PearCup',
    category: 'soccer',
    entrantShape: 'team',
    templateKind: 'single-elimination',
    defaultTeam: 'br',
    assets: root.defaultFitAssets('world-cup'),
    theme: {
      '--ink': '#4a3b57',
      '--muted': '#a897b3',
      '--soft': '#fff0f8',
      '--surface': '#ffffff',
      '--surface-2': '#fdf5fb',
      '--surface-3': '#f6eeff',
      '--line': '#ffd9ee',
      '--line-strong': '#f3c8e2',
      '--green': '#3fc4a8',
      '--green-deep': '#2ba98f',
      '--red': '#e56fa6',
      '--pink': '#ff8fc0',
      '--pink-deep': '#d15f96',
      '--blue': '#7cc4ff',
      '--blue-deep': '#3a90dd',
      '--grape': '#b79bff',
      '--gold': '#f0b93f',
      '--lemon': '#ffd76b'
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
    gameLeaderboardRows
  })
})(window)
