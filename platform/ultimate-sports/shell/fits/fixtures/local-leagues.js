// School / Office / Pub / Rec Sports fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "local-leagues",
  "title": "School / Office / Pub / Rec Sports",
  "subtitle": "Ultimate Sports",
  "category": "local",
  "entrantShape": "team",
  "templateKinds": ["round-robin","single-elimination","creator-custom"],
  "defaultTeam": "phoenix",
  "theme": {
    "--ink": "#0f291e",
    "--muted": "#a897b3",
    "--soft": "#f0fdf4",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#22c55e",
    "--green-deep": "#15803d",
    "--red": "#3b82f6",
    "--pink": "#3b82f6",
    "--pink-deep": "#15803d",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "phoenix",
      "name": "Phoenix FC",
      "flag": "⚽",
      "colors": [
        "#ef4444",
        "#f97316",
        "#ffffff"
      ]
    },
    {
      "id": "titan",
      "name": "Titan United",
      "flag": "⚽",
      "colors": [
        "#3b82f6",
        "#1d4ed8",
        "#ffffff"
      ]
    },
    {
      "id": "rover",
      "name": "Rovers",
      "flag": "⚽",
      "colors": [
        "#22c55e",
        "#15803d",
        "#ffffff"
      ]
    },
    {
      "id": "sting",
      "name": "Stingers",
      "flag": "⚽",
      "colors": [
        "#eab308",
        "#ca8a04",
        "#ffffff"
      ]
    },
    {
      "id": "thund",
      "name": "Thunder",
      "flag": "⚽",
      "colors": [
        "#a855f7",
        "#7e22ce",
        "#ffffff"
      ]
    },
    {
      "id": "shark",
      "name": "Sharks",
      "flag": "⚽",
      "colors": [
        "#06b6d4",
        "#0891b2",
        "#ffffff"
      ]
    },
    {
      "id": "vultu",
      "name": "Vultures",
      "flag": "⚽",
      "colors": [
        "#f43f5e",
        "#be123c",
        "#ffffff"
      ]
    },
    {
      "id": "panda",
      "name": "Pandas",
      "flag": "⚽",
      "colors": [
        "#10b981",
        "#047857",
        "#ffffff"
      ]
    },
    {
      "id": "eagle",
      "name": "Eagles",
      "flag": "🏈",
      "colors": [
        "#1e3a8a",
        "#facc15",
        "#ffffff"
      ]
    },
    {
      "id": "lion",
      "name": "Lions",
      "flag": "🏈",
      "colors": [
        "#c2410c",
        "#fdba74",
        "#ffffff"
      ]
    },
    {
      "id": "hawk",
      "name": "Hawks",
      "flag": "🏀",
      "colors": [
        "#7c3aed",
        "#c4b5fd",
        "#ffffff"
      ]
    },
    {
      "id": "blaze",
      "name": "Blazers",
      "flag": "🏀",
      "colors": [
        "#dc2626",
        "#fca5a5",
        "#ffffff"
      ]
    },
    {
      "id": "orca",
      "name": "Orcas",
      "flag": "🏐",
      "colors": [
        "#0e7490",
        "#67e8f9",
        "#ffffff"
      ]
    },
    {
      "id": "cobra",
      "name": "Cobras",
      "flag": "🏐",
      "colors": [
        "#15803d",
        "#86efac",
        "#ffffff"
      ]
    },
    {
      "id": "falcon",
      "name": "Falcons",
      "flag": "🥎",
      "colors": [
        "#b45309",
        "#fcd34d",
        "#ffffff"
      ]
    },
    {
      "id": "wolf",
      "name": "Wolves",
      "flag": "🥎",
      "colors": [
        "#4b5563",
        "#9ca3af",
        "#ffffff"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "Phoenix FC vs Titan United",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "Rovers vs Stingers",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "Thunder vs Sharks",
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
        "phoenix",
        "titan"
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
        "rover",
        "sting"
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
        "thund",
        "shark"
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
        "vultu",
        "panda"
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
        "eagle",
        "lion"
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
        "hawk",
        "blaze"
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
        "orca",
        "cobra"
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
        "falcon",
        "wolf"
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
    "title": "Phoenix FC vs Titan United",
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
      "Goals",
      "3",
      "2",
      60
    ],
    [
      "Shots",
      "14",
      "10",
      58
    ],
    [
      "Saves",
      "5",
      "4",
      56
    ],
    [
      "Possession",
      "56%",
      "44%",
      56
    ],
    [
      "Fouls",
      "8",
      "11",
      42
    ],
    [
      "Corners",
      "6",
      "3",
      67
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "phoenix",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "rover",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "titan",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "thund",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "vultu",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "sting",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "Phoenix FC vs Titan United is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "Rovers vs Stingers follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "Phoenix FC vs Titan United e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "Rovers vs Stingers vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "Phoenix FC vs Titan United es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "Rovers vs Stingers sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "Phoenix FC vs Titan United est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "Rovers vs Stingers suit ensuite."
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
      "text": "Phoenix FC/Titan United room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Rovers/Stingers pool is next on my list.",
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
      "shooterTeam": "phoenix",
      "keeper": "vera",
      "keeperTeam": "titan",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "titan",
      "keeper": "captain",
      "keeperTeam": "phoenix",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "phoenix",
      "keeper": "milo",
      "keeperTeam": "thund",
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
      "team": "phoenix",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "rover",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "titan",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "shark",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "thund",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/local-leagues.svg"
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
