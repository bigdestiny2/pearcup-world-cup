// Oscars / Grammys / Eurovision fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "awards-prediction-pools",
  "title": "Oscars / Grammys / Eurovision",
  "subtitle": "Ultimate Sports",
  "category": "awards",
  "entrantShape": "nominee",
  "defaultTeam": "oppen",
  "theme": {
    "--ink": "#2a1a08",
    "--muted": "#a897b3",
    "--soft": "#fffbeb",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#f59e0b",
    "--green-deep": "#b45309",
    "--red": "#ec4899",
    "--pink": "#ec4899",
    "--pink-deep": "#b45309",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "oppen",
      "name": "Oppenheimer",
      "flag": "🎬",
      "colors": [
        "#000000",
        "#f59e0b",
        "#ffffff"
      ]
    },
    {
      "id": "barb",
      "name": "Barbie",
      "flag": "🎬",
      "colors": [
        "#ec4899",
        "#f472b6",
        "#ffffff"
      ]
    },
    {
      "id": "poor",
      "name": "Poor Things",
      "flag": "🎬",
      "colors": [
        "#10b981",
        "#f59e0b",
        "#ffffff"
      ]
    },
    {
      "id": "kill",
      "name": "Killers of the Flower Moon",
      "flag": "🎬",
      "colors": [
        "#78350f",
        "#d97706",
        "#ffffff"
      ]
    },
    {
      "id": "hold",
      "name": "Holdovers",
      "flag": "🎬",
      "colors": [
        "#3b82f6",
        "#facc15",
        "#ffffff"
      ]
    },
    {
      "id": "past",
      "name": "Past Lives",
      "flag": "🎬",
      "colors": [
        "#f43f5e",
        "#fb7185",
        "#ffffff"
      ]
    },
    {
      "id": "anat",
      "name": "Anatomy of a Fall",
      "flag": "🎬",
      "colors": [
        "#1e293b",
        "#94a3b8",
        "#ffffff"
      ]
    },
    {
      "id": "zone",
      "name": "Zone of Interest",
      "flag": "🎬",
      "colors": [
        "#000000",
        "#ef4444",
        "#ffffff"
      ]
    },
    {
      "id": "tayl",
      "name": "Taylor Swift",
      "flag": "🎵",
      "colors": [
        "#a855f7",
        "#e879f9",
        "#ffffff"
      ]
    },
    {
      "id": "sza",
      "name": "SZA",
      "flag": "🎵",
      "colors": [
        "#22c55e",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "bilal",
      "name": "Bilal Hassani",
      "flag": "🎵",
      "colors": [
        "#06b6d4",
        "#f472b6",
        "#ffffff"
      ]
    },
    {
      "id": "lore",
      "name": "Loreen",
      "flag": "🎵",
      "colors": [
        "#f59e0b",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "kaar",
      "name": "Käärijä",
      "flag": "🎵",
      "colors": [
        "#16a34a",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "mahn",
      "name": "Mahmood",
      "flag": "🎵",
      "colors": [
        "#ef4444",
        "#10b981",
        "#ffffff"
      ]
    },
    {
      "id": "corn",
      "name": "Cornelia Jakobs",
      "flag": "🎵",
      "colors": [
        "#3b82f6",
        "#facc15",
        "#ffffff"
      ]
    },
    {
      "id": "samr",
      "name": "Sam Ryder",
      "flag": "🎵",
      "colors": [
        "#eab308",
        "#ec4899",
        "#ffffff"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "Oppenheimer vs Barbie",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "Poor Things vs Killers of the Flower Moon",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "Holdovers vs Past Lives",
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
        "oppen",
        "barb"
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
        "poor",
        "kill"
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
        "hold",
        "past"
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
        "anat",
        "zone"
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
        "tayl",
        "sza"
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
        "bilal",
        "lore"
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
        "kaar",
        "mahn"
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
        "corn",
        "samr"
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
    "title": "Oppenheimer vs Barbie",
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
      "Noms",
      "13",
      "8",
      62
    ],
    [
      "Wins",
      "7",
      "4",
      64
    ],
    [
      "Critics Score",
      "94%",
      "89%",
      51
    ],
    [
      "Audience Score",
      "91%",
      "85%",
      52
    ],
    [
      "Box Office",
      "$950M",
      "$620M",
      60
    ],
    [
      "Campaign Spend",
      "$42M",
      "$28M",
      60
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "oppen",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "poor",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "barb",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "hold",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "anat",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "kill",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "Oppenheimer vs Barbie is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "Poor Things vs Killers of the Flower Moon follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "Oppenheimer vs Barbie e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "Poor Things vs Killers of the Flower Moon vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "Oppenheimer vs Barbie es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "Poor Things vs Killers of the Flower Moon sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "Oppenheimer vs Barbie est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "Poor Things vs Killers of the Flower Moon suit ensuite."
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
      "text": "Oppenheimer/Barbie room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Poor Things/Killers of the Flower Moon pool is next on my list.",
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
      "shooterTeam": "oppen",
      "keeper": "vera",
      "keeperTeam": "barb",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "barb",
      "keeper": "captain",
      "keeperTeam": "oppen",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "oppen",
      "keeper": "milo",
      "keeperTeam": "hold",
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
      "team": "oppen",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "poor",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "barb",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "past",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "hold",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/awards-prediction-pools.svg"
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
