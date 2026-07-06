// Awards fit (Oscars / Grammys / Eurovision) — an awards-card template kind.
// Loaded AFTER generic-fits.js so this registration overrides the generic
// bracket version with a category → nominee "pick one per category" structure.
(function (root) {
  'use strict'

  // Each category is an independent pick: choose one nominee. No bracket, no
  // advancement — the awards-card renderer consumes `categories`.
  const categories = [
    {
      id: 'cat-picture', title: 'Best Picture', nominees: [
        { id: 'oppen', name: 'Oppenheimer', detail: 'Universal' },
        { id: 'barb', name: 'Barbie', detail: 'Warner Bros.' },
        { id: 'poor', name: 'Poor Things', detail: 'Searchlight' },
        { id: 'hold', name: 'The Holdovers', detail: 'Focus Features' }
      ]
    },
    {
      id: 'cat-drama', title: 'Best Drama', nominees: [
        { id: 'kill', name: 'Killers of the Flower Moon', detail: 'Apple' },
        { id: 'past', name: 'Past Lives', detail: 'A24' },
        { id: 'anat', name: 'Anatomy of a Fall', detail: 'Neon' },
        { id: 'zone', name: 'The Zone of Interest', detail: 'A24' }
      ]
    },
    {
      id: 'cat-record', title: 'Record of the Year', nominees: [
        { id: 'tayl', name: 'Taylor Swift', detail: '"Anti-Hero"' },
        { id: 'sza', name: 'SZA', detail: '"Kill Bill"' },
        { id: 'mahn', name: 'Mahmood', detail: '"Tuta Gold"' },
        { id: 'corn', name: 'Cornelia Jakobs', detail: '"Hold Me Closer"' }
      ]
    },
    {
      id: 'cat-euro', title: 'Eurovision Winner', nominees: [
        { id: 'lore', name: 'Loreen', detail: 'Sweden' },
        { id: 'kaar', name: 'Käärijä', detail: 'Finland' },
        { id: 'bilal', name: 'Bilal Hassani', detail: 'France' },
        { id: 'samr', name: 'Sam Ryder', detail: 'United Kingdom' }
      ]
    },
    {
      id: 'cat-song', title: 'Best Original Song', nominees: [
        { id: 'wimf', name: '"What Was I Made For?"', detail: 'Barbie' },
        { id: 'dance', name: '"Dance the Night"', detail: 'Barbie' },
        { id: 'wahzhazhe', name: '"Wahzhazhe"', detail: 'Killers of the Flower Moon' },
        { id: 'road', name: '"Road to Freedom"', detail: 'Rustin' }
      ]
    },
    {
      id: 'cat-breakthrough', title: 'Breakthrough Artist', nominees: [
        { id: 'bilal2', name: 'Bilal Hassani', detail: 'Pop' },
        { id: 'sza2', name: 'SZA', detail: 'R&B' },
        { id: 'kaar2', name: 'Käärijä', detail: 'Rap-metal' },
        { id: 'samr2', name: 'Sam Ryder', detail: 'Rock' }
      ]
    }
  ]

  const pools = [
    { tier: 10, entrants: 78, closes: '2d', max: 256, prize: '$780', heat: 'Open', rail: 'USDT demo' },
    { tier: 25, entrants: 46, closes: '2d', max: 160, prize: '$1,150', heat: 'Hot', rail: 'USDT demo' },
    { tier: 50, entrants: 24, closes: '1d', max: 96, prize: '$1,200', heat: 'Sharp', rail: 'USDT demo' },
    { tier: 100, entrants: 12, closes: '1d', max: 64, prize: '$1,200', heat: 'Elite', rail: 'USDT demo' }
  ]

  const homeFixtures = [
    { status: 'Ceremony', title: 'Best Picture reveal', detail: 'Final envelope of the night', live: true },
    { status: 'Tonight', title: 'Record of the Year', detail: 'Grammys ballot room', live: false },
    { status: 'Saturday', title: 'Eurovision grand final', detail: 'Jury + televote card', live: false }
  ]

  const leaders = [
    { user: 'lina', team: 'oppen', score: '5/6', prize: '$540' },
    { user: 'amara', team: 'poor', score: '5/6', prize: '$360' },
    { user: 'vera', team: 'barb', score: '4/6', prize: '$270' },
    { user: 'diego', team: 'past', score: '4/6', prize: '$195' },
    { user: 'milo', team: 'lore', score: '3/6', prize: '$140' },
    { user: 'kenji', team: 'sza', score: '3/6', prize: '$95' }
  ]

  const commentary = {
    EN: [
      ['Best Picture', 'The Best Picture envelope is the headline pick — lock it before the ceremony.'],
      ['Music', 'Record of the Year and Eurovision run on separate ballots tonight.'],
      ['Card', 'No result is invented before the envelope is opened.']
    ],
    PT: [
      ['Best Picture', 'O envelope de Melhor Filme é o palpite principal — feche antes da cerimônia.'],
      ['Music', 'Gravação do Ano e Eurovision têm cédulas separadas hoje.'],
      ['Card', 'Nenhum resultado é inventado antes do envelope ser aberto.']
    ],
    ES: [
      ['Best Picture', 'El sobre de Mejor Película es el pick principal — ciérralo antes de la ceremonia.'],
      ['Music', 'Grabación del Año y Eurovisión van en papeletas separadas esta noche.'],
      ['Card', 'Ningún resultado se inventa antes de abrir el sobre.']
    ],
    FR: [
      ['Best Picture', "L'enveloppe du Meilleur Film est le pick principal — verrouille-le avant la cérémonie."],
      ['Music', "Record of the Year et l'Eurovision sont sur des bulletins séparés ce soir."],
      ['Card', "Aucun résultat n'est inventé avant l'ouverture de l'enveloppe."]
    ]
  }

  const defaultChat = [
    { user: 'lina', text: 'Best Picture card is open. No envelope leaks until the reveal.', time: 'Ceremony' },
    { user: 'vera', text: 'Taking the Eurovision card next.', time: 'Tonight' },
    { user: 'ash', text: 'Ballot rooms are live.', time: 'Card' }
  ]

  root.registerFit('awards-prediction-pools', {
    fitId: 'awards-prediction-pools',
    title: 'Oscars / Grammys / Eurovision',
    subtitle: 'Ultimate Sports',
    category: 'awards',
    templateKind: 'awards-card',
    entrantShape: 'nominee',
    background: '#0e0a06',
    theme: {
      '--ink': '#f7ecd8',
      '--muted': '#b8a888',
      '--soft': '#0e0a06',
      '--surface': '#1a140c',
      '--surface-2': '#221a10',
      '--surface-3': '#2b2114',
      '--line': '#3a2e1c',
      '--line-strong': '#5a4826',
      '--green': '#f0b93f',
      '--green-deep': '#c98f22',
      '--red': '#ec4899',
      '--pink': '#f472b6',
      '--pink-deep': '#b45309',
      '--blue': '#7cc4ff',
      '--blue-deep': '#3a90dd',
      '--grape': '#b79bff',
      '--gold': '#f0b93f',
      '--lemon': '#ffd76b'
    },
    categories,
    pools,
    homeFixtures,
    leaders,
    commentary,
    defaultChat,
    assets: { heroBackdrop: '../generated/fit-heroes/awards-prediction-pools.svg' }
  })
})(window)
