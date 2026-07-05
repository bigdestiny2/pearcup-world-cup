// Champions League Knockout fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "champions-league-knockout",
  "title": "Champions League Knockout",
  "subtitle": "Ultimate Sports",
  "category": "soccer",
  "entrantShape": "team",
  "templateKinds": [
    "single-elimination"
  ],
  "recommendedVariants": [
    "classic-bracket",
    "confidence",
    "upset-bounty",
    "head-to-head-duel"
  ],
  "recommendedMiniGames": [
    "penalty-clash",
    "free-kick-duel",
    "next-event",
    "momentum-duel",
    "watch-party-streak",
    "reaction-challenge"
  ],
  "defaultTeam": "rm",
  "theme": {
    "--ink": "#0f172a",
    "--muted": "#a897b3",
    "--soft": "#f0f9ff",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#0ea5e9",
    "--green-deep": "#0369a1",
    "--red": "#f59e0b",
    "--pink": "#f59e0b",
    "--pink-deep": "#0369a1",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "rm",
      "name": "Real Madrid",
      "flag": "🇪🇸",
      "colors": [
        "#ffffff",
        "#00529f",
        "#f7c600"
      ]
    },
    {
      "id": "mc",
      "name": "Man City",
      "flag": "🏴",
      "colors": [
        "#6cabdd",
        "#ffffff",
        "#1c2044"
      ]
    },
    {
      "id": "bay",
      "name": "Bayern",
      "flag": "🇩🇪",
      "colors": [
        "#dc052d",
        "#ffffff",
        "#0066b2"
      ]
    },
    {
      "id": "psg",
      "name": "PSG",
      "flag": "🇫🇷",
      "colors": [
        "#004170",
        "#da291c",
        "#ffffff"
      ]
    },
    {
      "id": "liv",
      "name": "Liverpool",
      "flag": "🏴",
      "colors": [
        "#c8102e",
        "#ffffff",
        "#00b2a9"
      ]
    },
    {
      "id": "fcb",
      "name": "Barcelona",
      "flag": "🇪🇸",
      "colors": [
        "#a50044",
        "#004d98",
        "#edff00"
      ]
    },
    {
      "id": "juv",
      "name": "Juventus",
      "flag": "🇮🇹",
      "colors": [
        "#000000",
        "#ffffff",
        "#d6d6d6"
      ]
    },
    {
      "id": "dor",
      "name": "Dortmund",
      "flag": "🇩🇪",
      "colors": [
        "#fde100",
        "#000000",
        "#f0f0f0"
      ]
    },
    {
      "id": "atm",
      "name": "Atletico",
      "flag": "🇪🇸",
      "colors": [
        "#cb3524",
        "#ffffff",
        "#1a3c6e"
      ]
    },
    {
      "id": "int",
      "name": "Inter",
      "flag": "🇮🇹",
      "colors": [
        "#010e80",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "mil",
      "name": "AC Milan",
      "flag": "🇮🇹",
      "colors": [
        "#fb090b",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "ars",
      "name": "Arsenal",
      "flag": "🏴",
      "colors": [
        "#ef0107",
        "#ffffff",
        "#023474"
      ]
    },
    {
      "id": "che",
      "name": "Chelsea",
      "flag": "🏴",
      "colors": [
        "#034694",
        "#ffffff",
        "#d1d3d4"
      ]
    },
    {
      "id": "mun",
      "name": "Man United",
      "flag": "🏴",
      "colors": [
        "#da291c",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "ben",
      "name": "Benfica",
      "flag": "🇵🇹",
      "colors": [
        "#e30613",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "por",
      "name": "Porto",
      "flag": "🇵🇹",
      "colors": [
        "#003399",
        "#ffffff",
        "#000000"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "Real Madrid vs Man City",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "Bayern vs PSG",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "Liverpool vs Barcelona",
      "detail": "Round of 16 match room",
      "live": false
    }
  ],
  "round32Matches": [
    {
      "id": "r32-1",
      "time": "Round of 16",
      "status": "Open",
      "slots": [
        "rm",
        "mc"
      ],
      "score": [
        null,
        null
      ]
    },
    {
      "id": "r32-2",
      "time": "Round of 16",
      "status": "Open",
      "slots": [
        "bay",
        "psg"
      ],
      "score": [
        null,
        null
      ]
    },
    {
      "id": "r32-3",
      "time": "Round of 16",
      "status": "Open",
      "slots": [
        "liv",
        "fcb"
      ],
      "score": [
        null,
        null
      ]
    },
    {
      "id": "r32-4",
      "time": "Round of 16",
      "status": "Open",
      "slots": [
        "juv",
        "dor"
      ],
      "score": [
        null,
        null
      ]
    },
    {
      "id": "r32-5",
      "time": "Round of 16",
      "status": "Open",
      "slots": [
        "atm",
        "int"
      ],
      "score": [
        null,
        null
      ]
    },
    {
      "id": "r32-6",
      "time": "Round of 16",
      "status": "Open",
      "slots": [
        "mil",
        "ars"
      ],
      "score": [
        null,
        null
      ]
    },
    {
      "id": "r32-7",
      "time": "Round of 16",
      "status": "Open",
      "slots": [
        "che",
        "mun"
      ],
      "score": [
        null,
        null
      ]
    },
    {
      "id": "r32-8",
      "time": "Round of 16",
      "status": "Open",
      "slots": [
        "ben",
        "por"
      ],
      "score": [
        null,
        null
      ]
    }
  ],
  "bracketLinks": [
    {
      "from": [
        "r32-1",
        "r32-2"
      ],
      "to": "r16-1"
    },
    {
      "from": [
        "r32-3",
        "r32-4"
      ],
      "to": "r16-2"
    },
    {
      "from": [
        "r32-5",
        "r32-6"
      ],
      "to": "r16-3"
    },
    {
      "from": [
        "r32-7",
        "r32-8"
      ],
      "to": "r16-4"
    },
    {
      "from": [
        "r16-1",
        "r16-2"
      ],
      "to": "qf-1"
    },
    {
      "from": [
        "r16-3",
        "r16-4"
      ],
      "to": "qf-2"
    },
    {
      "from": [
        "qf-1",
        "qf-2"
      ],
      "to": "sf-1"
    },
    {
      "from": [
        "sf-1"
      ],
      "to": "final-1"
    }
  ],
  "bracketMatchIds": [
    "r32-1",
    "r32-2",
    "r32-3",
    "r32-4",
    "r32-5",
    "r32-6",
    "r32-7",
    "r32-8",
    "r16-1",
    "r16-2",
    "r16-3",
    "r16-4",
    "qf-1",
    "qf-2",
    "sf-1",
    "final-1"
  ],
  "liveMatch": {
    "status": "Today",
    "title": "Real Madrid vs Man City",
    "detail": "Round of 16 match room",
    "live": true
  },
  "pools": [
    {
      "tier": 10,
      "entrants": 92,
      "closes": "12h",
      "max": 256,
      "prize": "$920",
      "heat": "Open",
      "rail": "USDT demo"
    },
    {
      "tier": 25,
      "entrants": 58,
      "closes": "9h",
      "max": 160,
      "prize": "$1,450",
      "heat": "Hot",
      "rail": "USDT demo"
    },
    {
      "tier": 50,
      "entrants": 32,
      "closes": "7h",
      "max": 96,
      "prize": "$1,600",
      "heat": "Sharp",
      "rail": "USDT demo"
    },
    {
      "tier": 100,
      "entrants": 16,
      "closes": "5h",
      "max": 64,
      "prize": "$1,600",
      "heat": "Elite",
      "rail": "USDT demo"
    }
  ],
  "matchStats": [
    [
      "Possession",
      "54%",
      "46%",
      54
    ],
    [
      "Shots",
      "13",
      "8",
      62
    ],
    [
      "xG",
      "1.68",
      "1.05",
      62
    ],
    [
      "Pass accuracy",
      "88%",
      "83%",
      57
    ],
    [
      "Corners",
      "6",
      "3",
      67
    ],
    [
      "Saves",
      "2",
      "4",
      33
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "rm",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "bay",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "mc",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "liv",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "juv",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "psg",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "Real Madrid vs Man City is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "Bayern vs PSG follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "Real Madrid vs Man City e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "Bayern vs PSG vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "Real Madrid vs Man City es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "Bayern vs PSG sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "Real Madrid vs Man City est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "Bayern vs PSG suit ensuite."
      ],
      [
        "Bracket",
        "L impact du pool est actif, mais le fallback ne fabrique pas de resultats."
      ]
    ]
  },
  "defaultChat": [
    {
      "user": "lina",
      "text": "Real Madrid/Man City room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Bayern/PSG pool is next on my list.",
      "time": "Next"
    },
    {
      "user": "ash",
      "text": "Bracket is still Round of 16.",
      "time": "R16"
    }
  ],
  "gameRounds": [
    {
      "shooter": "captain",
      "shooterTeam": "rm",
      "keeper": "vera",
      "keeperTeam": "mc",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "mc",
      "keeper": "captain",
      "keeperTeam": "rm",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "rm",
      "keeper": "milo",
      "keeperTeam": "liv",
      "aim": "center-high",
      "dive": "left-high",
      "power": 4,
      "curve": 2,
      "releaseTick": 45,
      "keeperTick": 44
    }
  ],
  "gameLeaderboardRows": [
    {
      "user": "captain",
      "team": "rm",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "bay",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "mc",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "fcb",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "liv",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "templateData": {},
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/champions-league-knockout.svg"
  }
}

  cfg.entrants = cfg.teams
  cfg.fixtures = cfg.homeFixtures

  if (typeof root !== 'undefined' && typeof root.registerFit === 'function') {
    root.registerFit(cfg.fitId, cfg)
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = cfg
  }
})(typeof window !== 'undefined' ? window : globalThis)
