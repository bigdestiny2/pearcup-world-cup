// World Cup — canonical kawaii fit (uses the default shell data).
(function (root) {
  'use strict'

  const teams = [
    { id: 'br', name: 'Brazil', flag: '🇧🇷', colors: ['#139b49', '#ffd447', '#1b55a5'] },
    { id: 'jp', name: 'Japan', flag: '🇯🇵', colors: ['#f6f6f6', '#d91f3c', '#0a2f68'] },
    { id: 'ci', name: 'Ivory Coast', flag: '🇨🇮', colors: ['#f27b22', '#ffffff', '#159759'] },
    { id: 'no', name: 'Norway', flag: '🇳🇴', colors: ['#d91f3c', '#ffffff', '#143d8d'] },
    { id: 'mx', name: 'Mexico', flag: '🇲🇽', colors: ['#0c8c57', '#ffffff', '#d43f3a'] },
    { id: 'ec', name: 'Ecuador', flag: '🇪🇨', colors: ['#f9d33a', '#1f5aa6', '#d13d32'] },
    { id: 'eng', name: 'England', flag: '🏴', colors: ['#ffffff', '#d41f35', '#1c3764'] },
    { id: 'cd', name: 'DR Congo', flag: '🇨🇩', colors: ['#2a9bd8', '#f3d13d', '#d84a3a'] },
    { id: 'ch', name: 'Switzerland', flag: '🇨🇭', colors: ['#d71920', '#ffffff', '#901019'] },
    { id: 'dz', name: 'Algeria', flag: '🇩🇿', colors: ['#ffffff', '#00843d', '#d21034'] },
    { id: 'pt', name: 'Portugal', flag: '🇵🇹', colors: ['#d71920', '#006b3f', '#f6c343'] },
    { id: 'hr', name: 'Croatia', flag: '🇭🇷', colors: ['#ffffff', '#d7272f', '#1f5aa6'] },
    { id: 'es', name: 'Spain', flag: '🇪🇸', colors: ['#c60b1e', '#ffc400', '#75131a'] },
    { id: 'at', name: 'Austria', flag: '🇦🇹', colors: ['#ed2939', '#ffffff', '#8f1d27'] },
    { id: 'fr', name: 'France', flag: '🇫🇷', colors: ['#1d3d8f', '#ffffff', '#d84a3a'] },
    { id: 'ar', name: 'Argentina', flag: '🇦🇷', colors: ['#75aadb', '#ffffff', '#f6b33f'] }
  ]

  const groups = [
    { name: 'Group A', entrants: [
      { teamId: 'br', name: 'Brazil', flag: '🇧🇷', played: 3, wins: 2, draws: 1, losses: 0, points: 7, gd: 4 },
      { teamId: 'jp', name: 'Japan', flag: '🇯🇵', played: 3, wins: 1, draws: 1, losses: 1, points: 4, gd: 0 },
      { teamId: 'ci', name: 'Ivory Coast', flag: '🇨🇮', played: 3, wins: 1, draws: 0, losses: 2, points: 3, gd: -2 },
      { teamId: 'no', name: 'Norway', flag: '🇳🇴', played: 3, wins: 0, draws: 0, losses: 3, points: 0, gd: -2 }
    ]},
    { name: 'Group B', entrants: [
      { teamId: 'mx', name: 'Mexico', flag: '🇲🇽', played: 3, wins: 2, draws: 0, losses: 1, points: 6, gd: 2 },
      { teamId: 'ec', name: 'Ecuador', flag: '🇪🇨', played: 3, wins: 1, draws: 2, losses: 0, points: 5, gd: 1 },
      { teamId: 'eng', name: 'England', flag: '🏴', played: 3, wins: 1, draws: 1, losses: 1, points: 4, gd: -1 },
      { teamId: 'cd', name: 'DR Congo', flag: '🇨🇩', played: 3, wins: 0, draws: 1, losses: 2, points: 1, gd: -2 }
    ]},
    { name: 'Group C', entrants: [
      { teamId: 'ch', name: 'Switzerland', flag: '🇨🇭', played: 3, wins: 2, draws: 1, losses: 0, points: 7, gd: 3 },
      { teamId: 'dz', name: 'Algeria', flag: '🇩🇿', played: 3, wins: 2, draws: 0, losses: 1, points: 6, gd: 2 },
      { teamId: 'pt', name: 'Portugal', flag: '🇵🇹', played: 3, wins: 0, draws: 1, losses: 2, points: 1, gd: -3 },
      { teamId: 'hr', name: 'Croatia', flag: '🇭🇷', played: 3, wins: 0, draws: 0, losses: 3, points: 0, gd: -2 }
    ]},
    { name: 'Group D', entrants: [
      { teamId: 'es', name: 'Spain', flag: '🇪🇸', played: 3, wins: 3, draws: 0, losses: 0, points: 9, gd: 5 },
      { teamId: 'at', name: 'Austria', flag: '🇦🇹', played: 3, wins: 1, draws: 1, losses: 1, points: 4, gd: 0 },
      { teamId: 'fr', name: 'France', flag: '🇫🇷', played: 3, wins: 1, draws: 0, losses: 2, points: 3, gd: -2 },
      { teamId: 'ar', name: 'Argentina', flag: '🇦🇷', played: 3, wins: 0, draws: 1, losses: 2, points: 1, gd: -3 }
    ]}
  ]

  root.registerFit('world-cup', {
    fitId: 'world-cup',
    title: 'World Cup',
    subtitle: 'PearCup',
    category: 'soccer',
    entrantShape: 'team',
    templateKinds: ['group-plus-knockout', 'single-elimination'],
    defaultTeam: 'br',
    assets: { heroBackdrop: '../generated/fit-heroes/world-cup.svg' },
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
    entrants: teams,
    templateData: { groups }
  })
})(window)
