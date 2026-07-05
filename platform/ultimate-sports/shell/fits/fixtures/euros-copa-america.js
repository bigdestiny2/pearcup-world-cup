// Euros / Copa America fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "euros-copa-america",
  "title": "Euros / Copa America",
  "subtitle": "Ultimate Sports",
  "category": "soccer",
  "entrantShape": "team",
  "templateKinds": ["group-plus-knockout","single-elimination"],
  "defaultTeam": "fr",
  "theme": {
    "--ink": "#1e293b",
    "--muted": "#a897b3",
    "--soft": "#eff6ff",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#3b82f6",
    "--green-deep": "#1d4ed8",
    "--red": "#ef4444",
    "--pink": "#ef4444",
    "--pink-deep": "#1d4ed8",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "fr",
      "name": "France",
      "flag": "🇫🇷",
      "colors": [
        "#1d3d8f",
        "#ffffff",
        "#d84a3a"
      ]
    },
    {
      "id": "de",
      "name": "Germany",
      "flag": "🇩🇪",
      "colors": [
        "#000000",
        "#dd0000",
        "#ffce00"
      ]
    },
    {
      "id": "es",
      "name": "Spain",
      "flag": "🇪🇸",
      "colors": [
        "#c60b1e",
        "#ffc400",
        "#75131a"
      ]
    },
    {
      "id": "eng",
      "name": "England",
      "flag": "🏴",
      "colors": [
        "#ffffff",
        "#d41f35",
        "#1c3764"
      ]
    },
    {
      "id": "pt",
      "name": "Portugal",
      "flag": "🇵🇹",
      "colors": [
        "#d71920",
        "#006b3f",
        "#f6c343"
      ]
    },
    {
      "id": "it",
      "name": "Italy",
      "flag": "🇮🇹",
      "colors": [
        "#009246",
        "#ffffff",
        "#ce2b37"
      ]
    },
    {
      "id": "nl",
      "name": "Netherlands",
      "flag": "🇳🇱",
      "colors": [
        "#ae1c28",
        "#ffffff",
        "#21468b"
      ]
    },
    {
      "id": "ar",
      "name": "Argentina",
      "flag": "🇦🇷",
      "colors": [
        "#75aadb",
        "#ffffff",
        "#f6b33f"
      ]
    },
    {
      "id": "br",
      "name": "Brazil",
      "flag": "🇧🇷",
      "colors": [
        "#139b49",
        "#ffd447",
        "#1b55a5"
      ]
    },
    {
      "id": "mx",
      "name": "Mexico",
      "flag": "🇲🇽",
      "colors": [
        "#0c8c57",
        "#ffffff",
        "#d43f3a"
      ]
    },
    {
      "id": "co",
      "name": "Colombia",
      "flag": "🇨🇴",
      "colors": [
        "#fcd116",
        "#003893",
        "#ce1126"
      ]
    },
    {
      "id": "us",
      "name": "United States",
      "flag": "🇺🇸",
      "colors": [
        "#ffffff",
        "#b31942",
        "#0a3161"
      ]
    },
    {
      "id": "ca",
      "name": "Canada",
      "flag": "🇨🇦",
      "colors": [
        "#ff0000",
        "#ffffff",
        "#8a1538"
      ]
    },
    {
      "id": "uy",
      "name": "Uruguay",
      "flag": "🇺🇾",
      "colors": [
        "#ffffff",
        "#0038a8",
        "#000000"
      ]
    },
    {
      "id": "ec",
      "name": "Ecuador",
      "flag": "🇪🇨",
      "colors": [
        "#f9d33a",
        "#1f5aa6",
        "#d13d32"
      ]
    },
    {
      "id": "cl",
      "name": "Chile",
      "flag": "🇨🇱",
      "colors": [
        "#ffffff",
        "#d52b1e",
        "#0039a6"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "France vs Germany",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "Spain vs England",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "Portugal vs Italy",
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
        "fr",
        "de"
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
        "es",
        "eng"
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
        "pt",
        "it"
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
        "nl",
        "ar"
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
        "br",
        "mx"
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
        "co",
        "us"
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
        "ca",
        "uy"
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
        "ec",
        "cl"
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
    "title": "France vs Germany",
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
      "52%",
      "48%",
      52
    ],
    [
      "Shots",
      "11",
      "9",
      55
    ],
    [
      "xG",
      "1.45",
      "1.22",
      54
    ],
    [
      "Pass accuracy",
      "86%",
      "84%",
      51
    ],
    [
      "Corners",
      "5",
      "4",
      56
    ],
    [
      "Saves",
      "2",
      "3",
      40
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "fr",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "es",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "de",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "pt",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "nl",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "eng",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "France vs Germany is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "Spain vs England follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "France vs Germany e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "Spain vs England vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "France vs Germany es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "Spain vs England sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "France vs Germany est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "Spain vs England suit ensuite."
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
      "text": "France/Germany room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Spain/England pool is next on my list.",
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
      "shooterTeam": "fr",
      "keeper": "vera",
      "keeperTeam": "de",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "de",
      "keeper": "captain",
      "keeperTeam": "fr",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "fr",
      "keeper": "milo",
      "keeperTeam": "pt",
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
      "team": "fr",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "es",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "de",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "it",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "pt",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/euros-copa-america.svg"
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
