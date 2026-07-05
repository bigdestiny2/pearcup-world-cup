// Tennis Grand Slams fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "tennis-grand-slams",
  "title": "Tennis Grand Slams",
  "subtitle": "Ultimate Sports",
  "category": "tennis",
  "entrantShape": "player",
  "defaultTeam": "alcaraz",
  "theme": {
    "--ink": "#0f2c22",
    "--muted": "#a897b3",
    "--soft": "#ecfdf5",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#10b981",
    "--green-deep": "#047857",
    "--red": "#f59e0b",
    "--pink": "#f59e0b",
    "--pink-deep": "#047857",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "alcaraz",
      "name": "Alcaraz",
      "flag": "🎾",
      "colors": [
        "#ffffff",
        "#22c55e",
        "#15803d"
      ]
    },
    {
      "id": "djok",
      "name": "Djokovic",
      "flag": "🎾",
      "colors": [
        "#1e3a8a",
        "#ffffff",
        "#1d4ed8"
      ]
    },
    {
      "id": "sinner",
      "name": "Sinner",
      "flag": "🎾",
      "colors": [
        "#166534",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "nadal",
      "name": "Nadal",
      "flag": "🎾",
      "colors": [
        "#dc2626",
        "#facc15",
        "#000000"
      ]
    },
    {
      "id": "medv",
      "name": "Medvedev",
      "flag": "🎾",
      "colors": [
        "#ffffff",
        "#3b82f6",
        "#1e40af"
      ]
    },
    {
      "id": "zverev",
      "name": "Zverev",
      "flag": "🎾",
      "colors": [
        "#facc15",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "rune",
      "name": "Rune",
      "flag": "🎾",
      "colors": [
        "#ef4444",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "tsits",
      "name": "Tsitsipas",
      "flag": "🎾",
      "colors": [
        "#0ea5e9",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "swia",
      "name": "Swiatek",
      "flag": "🎾",
      "colors": [
        "#ec4899",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "saba",
      "name": "Sabalenka",
      "flag": "🎾",
      "colors": [
        "#a855f7",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "ryba",
      "name": "Rybakina",
      "flag": "🎾",
      "colors": [
        "#14b8a6",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "gauff",
      "name": "Gauff",
      "flag": "🎾",
      "colors": [
        "#22c55e",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "jabeu",
      "name": "Jabeur",
      "flag": "🎾",
      "colors": [
        "#f97316",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "peg",
      "name": "Pegula",
      "flag": "🎾",
      "colors": [
        "#3b82f6",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "vond",
      "name": "Vondrousova",
      "flag": "🎾",
      "colors": [
        "#eab308",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "krejc",
      "name": "Krejcikova",
      "flag": "🎾",
      "colors": [
        "#ef4444",
        "#ffffff",
        "#000000"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "Alcaraz vs Djokovic",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "Sinner vs Nadal",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "Medvedev vs Zverev",
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
        "alcaraz",
        "djok"
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
        "sinner",
        "nadal"
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
        "medv",
        "zverev"
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
        "rune",
        "tsits"
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
        "swia",
        "saba"
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
        "ryba",
        "gauff"
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
        "jabeu",
        "peg"
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
        "vond",
        "krejc"
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
    "title": "Alcaraz vs Djokovic",
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
      "Aces",
      "12",
      "8",
      60
    ],
    [
      "Winners",
      "34",
      "28",
      55
    ],
    [
      "Unforced Errors",
      "18",
      "22",
      55
    ],
    [
      "Break Points",
      "4",
      "2",
      67
    ],
    [
      "First Serve %",
      "68%",
      "61%",
      53
    ],
    [
      "Net Points",
      "18",
      "12",
      60
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "alcaraz",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "sinner",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "djok",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "medv",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "rune",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "nadal",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "Alcaraz vs Djokovic is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "Sinner vs Nadal follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "Alcaraz vs Djokovic e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "Sinner vs Nadal vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "Alcaraz vs Djokovic es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "Sinner vs Nadal sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "Alcaraz vs Djokovic est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "Sinner vs Nadal suit ensuite."
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
      "text": "Alcaraz/Djokovic room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Sinner/Nadal pool is next on my list.",
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
      "shooterTeam": "alcaraz",
      "keeper": "vera",
      "keeperTeam": "djok",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "djok",
      "keeper": "captain",
      "keeperTeam": "alcaraz",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "alcaraz",
      "keeper": "milo",
      "keeperTeam": "medv",
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
      "team": "alcaraz",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "sinner",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "djok",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "zverev",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "medv",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/tennis-grand-slams.svg"
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
