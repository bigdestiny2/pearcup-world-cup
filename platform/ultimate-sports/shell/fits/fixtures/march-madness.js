// March Madness fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "march-madness",
  "title": "March Madness",
  "subtitle": "Ultimate Sports",
  "category": "basketball",
  "entrantShape": "team",
  "defaultTeam": "uconn",
  "theme": {
    "--ink": "#2a1510",
    "--muted": "#a897b3",
    "--soft": "#fff7ed",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#f97316",
    "--green-deep": "#c2410c",
    "--red": "#3b82f6",
    "--pink": "#3b82f6",
    "--pink-deep": "#c2410c",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "uconn",
      "name": "UConn",
      "flag": "🏀",
      "colors": [
        "#002868",
        "#ffffff",
        "#e4002b"
      ]
    },
    {
      "id": "purdue",
      "name": "Purdue",
      "flag": "🏀",
      "colors": [
        "#ceb888",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "unc",
      "name": "North Carolina",
      "flag": "🏀",
      "colors": [
        "#7bafd4",
        "#ffffff",
        "#101820"
      ]
    },
    {
      "id": "duke",
      "name": "Duke",
      "flag": "🏀",
      "colors": [
        "#003087",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "kansas",
      "name": "Kansas",
      "flag": "🏀",
      "colors": [
        "#0051ba",
        "#ffffff",
        "#e8000d"
      ]
    },
    {
      "id": "zaga",
      "name": "Gonzaga",
      "flag": "🏀",
      "colors": [
        "#00295a",
        "#ffffff",
        "#c8102e"
      ]
    },
    {
      "id": "houston",
      "name": "Houston",
      "flag": "🏀",
      "colors": [
        "#c8102e",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "tn",
      "name": "Tennessee",
      "flag": "🏀",
      "colors": [
        "#ff8200",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "auburn",
      "name": "Auburn",
      "flag": "🏀",
      "colors": [
        "#0c2340",
        "#ffffff",
        "#e87722"
      ]
    },
    {
      "id": "ariz",
      "name": "Arizona",
      "flag": "🏀",
      "colors": [
        "#cc0033",
        "#ffffff",
        "#003366"
      ]
    },
    {
      "id": "baylor",
      "name": "Baylor",
      "flag": "🏀",
      "colors": [
        "#154734",
        "#ffffff",
        "#ffb81c"
      ]
    },
    {
      "id": "kent",
      "name": "Kentucky",
      "flag": "🏀",
      "colors": [
        "#0033a0",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "marq",
      "name": "Marquette",
      "flag": "🏀",
      "colors": [
        "#003366",
        "#ffffff",
        "#f4c430"
      ]
    },
    {
      "id": "mich",
      "name": "Michigan St",
      "flag": "🏀",
      "colors": [
        "#18453b",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "fla",
      "name": "Florida",
      "flag": "🏀",
      "colors": [
        "#0021a5",
        "#ffffff",
        "#fa4616"
      ]
    },
    {
      "id": "tex",
      "name": "Texas",
      "flag": "🏀",
      "colors": [
        "#bf5700",
        "#ffffff",
        "#333f48"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "UConn vs Purdue",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "North Carolina vs Duke",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "Kansas vs Gonzaga",
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
        "uconn",
        "purdue"
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
        "unc",
        "duke"
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
        "kansas",
        "zaga"
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
        "houston",
        "tn"
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
        "auburn",
        "ariz"
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
        "baylor",
        "kent"
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
        "marq",
        "mich"
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
        "fla",
        "tex"
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
    "title": "UConn vs Purdue",
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
      "Field Goals",
      "48%",
      "44%",
      52
    ],
    [
      "3-Pointers",
      "12",
      "9",
      57
    ],
    [
      "Rebounds",
      "34",
      "29",
      54
    ],
    [
      "Assists",
      "16",
      "12",
      57
    ],
    [
      "Turnovers",
      "8",
      "11",
      42
    ],
    [
      "Free Throws",
      "18",
      "14",
      56
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "uconn",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "unc",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "purdue",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "kansas",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "houston",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "duke",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "UConn vs Purdue is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "North Carolina vs Duke follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "UConn vs Purdue e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "North Carolina vs Duke vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "UConn vs Purdue es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "North Carolina vs Duke sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "UConn vs Purdue est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "North Carolina vs Duke suit ensuite."
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
      "text": "UConn/Purdue room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "North Carolina/Duke pool is next on my list.",
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
      "shooterTeam": "uconn",
      "keeper": "vera",
      "keeperTeam": "purdue",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "purdue",
      "keeper": "captain",
      "keeperTeam": "uconn",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "uconn",
      "keeper": "milo",
      "keeperTeam": "kansas",
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
      "team": "uconn",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "unc",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "purdue",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "zaga",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "kansas",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/march-madness.svg"
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
