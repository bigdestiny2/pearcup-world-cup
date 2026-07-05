// NBA / NHL / MLB Playoffs fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "pro-playoffs",
  "title": "NBA / NHL / MLB Playoffs",
  "subtitle": "Ultimate Sports",
  "category": "pro-sports",
  "entrantShape": "team",
  "defaultTeam": "lal",
  "theme": {
    "--ink": "#1a1025",
    "--muted": "#a897b3",
    "--soft": "#f5f3ff",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#8b5cf6",
    "--green-deep": "#6d28d9",
    "--red": "#f43f5e",
    "--pink": "#f43f5e",
    "--pink-deep": "#6d28d9",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "lal",
      "name": "Lakers",
      "flag": "🏆",
      "colors": [
        "#552583",
        "#fdb927",
        "#000000"
      ]
    },
    {
      "id": "bos",
      "name": "Celtics",
      "flag": "🏆",
      "colors": [
        "#007a33",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "gs",
      "name": "Warriors",
      "flag": "🏆",
      "colors": [
        "#1d428a",
        "#ffc72c",
        "#ffffff"
      ]
    },
    {
      "id": "den",
      "name": "Nuggets",
      "flag": "🏆",
      "colors": [
        "#0e2240",
        "#fec524",
        "#1d428a"
      ]
    },
    {
      "id": "mia",
      "name": "Heat",
      "flag": "🏆",
      "colors": [
        "#98002e",
        "#f9a01b",
        "#000000"
      ]
    },
    {
      "id": "phi",
      "name": "76ers",
      "flag": "🏆",
      "colors": [
        "#006bb6",
        "#ed174c",
        "#ffffff"
      ]
    },
    {
      "id": "mil",
      "name": "Bucks",
      "flag": "🏆",
      "colors": [
        "#00471b",
        "#eee1c6",
        "#ffffff"
      ]
    },
    {
      "id": "dal",
      "name": "Mavericks",
      "flag": "🏆",
      "colors": [
        "#00538c",
        "#b8c4ca",
        "#000000"
      ]
    },
    {
      "id": "col",
      "name": "Avalanche",
      "flag": "🏆",
      "colors": [
        "#6f263d",
        "#236192",
        "#a2aaad"
      ]
    },
    {
      "id": "edm",
      "name": "Oilers",
      "flag": "🏆",
      "colors": [
        "#041e42",
        "#ff4c00",
        "#ffffff"
      ]
    },
    {
      "id": "nyr",
      "name": "Rangers",
      "flag": "🏆",
      "colors": [
        "#0033a0",
        "#c8102e",
        "#ffffff"
      ]
    },
    {
      "id": "tb",
      "name": "Lightning",
      "flag": "🏆",
      "colors": [
        "#002868",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "nyy",
      "name": "Yankees",
      "flag": "🏆",
      "colors": [
        "#003087",
        "#ffffff",
        "#e4002c"
      ]
    },
    {
      "id": "lad",
      "name": "Dodgers",
      "flag": "🏆",
      "colors": [
        "#005a9c",
        "#ffffff",
        "#ef3e42"
      ]
    },
    {
      "id": "houa",
      "name": "Astros",
      "flag": "🏆",
      "colors": [
        "#002d62",
        "#eb6e1f",
        "#ffffff"
      ]
    },
    {
      "id": "atl",
      "name": "Braves",
      "flag": "🏆",
      "colors": [
        "#ce1141",
        "#13274f",
        "#ffffff"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "Lakers vs Celtics",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "Warriors vs Nuggets",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "Heat vs 76ers",
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
        "lal",
        "bos"
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
        "gs",
        "den"
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
        "mia",
        "phi"
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
        "mil",
        "dal"
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
        "col",
        "edm"
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
        "nyr",
        "tb"
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
        "nyy",
        "lad"
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
        "houa",
        "atl"
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
    "title": "Lakers vs Celtics",
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
      "Points",
      "112",
      "108",
      51
    ],
    [
      "3-Pointers",
      "14",
      "11",
      56
    ],
    [
      "Rebounds",
      "42",
      "38",
      53
    ],
    [
      "Assists",
      "26",
      "22",
      54
    ],
    [
      "Steals",
      "8",
      "6",
      57
    ],
    [
      "FG%",
      "49%",
      "46%",
      52
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "lal",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "gs",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "bos",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "mia",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "mil",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "den",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "Lakers vs Celtics is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "Warriors vs Nuggets follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "Lakers vs Celtics e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "Warriors vs Nuggets vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "Lakers vs Celtics es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "Warriors vs Nuggets sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "Lakers vs Celtics est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "Warriors vs Nuggets suit ensuite."
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
      "text": "Lakers/Celtics room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Warriors/Nuggets pool is next on my list.",
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
      "shooterTeam": "lal",
      "keeper": "vera",
      "keeperTeam": "bos",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "bos",
      "keeper": "captain",
      "keeperTeam": "lal",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "lal",
      "keeper": "milo",
      "keeperTeam": "mia",
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
      "team": "lal",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "gs",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "bos",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "phi",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "mia",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/pro-playoffs.svg"
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
