// World Cup — canonical kawaii fit (uses the default shell data).
(function (root) {
  'use strict'
  root.registerFit('world-cup', {
    fitId: 'world-cup',
    title: 'World Cup',
    subtitle: 'PearCup',
    category: 'soccer',
    entrantShape: 'team',
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
    }
  })
})(window)
