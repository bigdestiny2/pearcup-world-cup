// SailGP Companion fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "sailgp-companion",
  "title": "SailGP Companion",
  "subtitle": "Ultimate Sports",
  "category": "sailing",
  "entrantShape": "team",
  "templateKinds": ["series-playoff","round-robin"],
  "defaultTeam": "aus",
  "theme": {
    "--ink": "#082f49",
    "--muted": "#a897b3",
    "--soft": "#ecfeff",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#06b6d4",
    "--green-deep": "#0e7490",
    "--red": "#f43f5e",
    "--pink": "#f43f5e",
    "--pink-deep": "#0e7490",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "aus",
      "name": "Australia",
      "flag": "🇦🇺",
      "colors": [
        "#012169",
        "#ffcd00",
        "#00843d"
      ]
    },
    {
      "id": "gbr",
      "name": "Great Britain",
      "flag": "🇬🇧",
      "colors": [
        "#ffffff",
        "#d41f35",
        "#1c3764"
      ]
    },
    {
      "id": "nz",
      "name": "New Zealand",
      "flag": "🇳🇿",
      "colors": [
        "#00247d",
        "#ffffff",
        "#cc142b"
      ]
    },
    {
      "id": "usa",
      "name": "United States",
      "flag": "🇺🇸",
      "colors": [
        "#ffffff",
        "#b31942",
        "#0a3161"
      ]
    },
    {
      "id": "fra",
      "name": "France",
      "flag": "🇫🇷",
      "colors": [
        "#1d3d8f",
        "#ffffff",
        "#d84a3a"
      ]
    },
    {
      "id": "den",
      "name": "Denmark",
      "flag": "🇩🇰",
      "colors": [
        "#c8102e",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "jpn",
      "name": "Japan",
      "flag": "🇯🇵",
      "colors": [
        "#f6f6f6",
        "#d91f3c",
        "#0a2f68"
      ]
    },
    {
      "id": "esp",
      "name": "Spain",
      "flag": "🇪🇸",
      "colors": [
        "#c60b1e",
        "#ffc400",
        "#75131a"
      ]
    },
    {
      "id": "ger",
      "name": "Germany",
      "flag": "🇩🇪",
      "colors": [
        "#000000",
        "#dd0000",
        "#ffce00"
      ]
    },
    {
      "id": "can",
      "name": "Canada",
      "flag": "🇨🇦",
      "colors": [
        "#ff0000",
        "#ffffff",
        "#8a1538"
      ]
    },
    {
      "id": "sui",
      "name": "Switzerland",
      "flag": "🇨🇭",
      "colors": [
        "#d71920",
        "#ffffff",
        "#901019"
      ]
    },
    {
      "id": "bra",
      "name": "Brazil",
      "flag": "🇧🇷",
      "colors": [
        "#139b49",
        "#ffd447",
        "#1b55a5"
      ]
    },
    {
      "id": "ita",
      "name": "Italy",
      "flag": "🇮🇹",
      "colors": [
        "#009246",
        "#ffffff",
        "#ce2b37"
      ]
    },
    {
      "id": "ned",
      "name": "Netherlands",
      "flag": "🇳🇱",
      "colors": [
        "#ae1c28",
        "#ffffff",
        "#21468b"
      ]
    },
    {
      "id": "arg",
      "name": "Argentina",
      "flag": "🇦🇷",
      "colors": [
        "#75aadb",
        "#ffffff",
        "#f6b33f"
      ]
    },
    {
      "id": "swe",
      "name": "Sweden",
      "flag": "🇸🇪",
      "colors": [
        "#006aa7",
        "#fecc00",
        "#0b4f7a"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "Australia vs Great Britain",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "New Zealand vs United States",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "France vs Denmark",
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
        "aus",
        "gbr"
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
        "nz",
        "usa"
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
        "fra",
        "den"
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
        "jpn",
        "esp"
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
        "ger",
        "can"
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
        "sui",
        "bra"
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
        "ita",
        "ned"
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
        "arg",
        "swe"
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
    "title": "Australia vs Great Britain",
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
      "Top Speed",
      "96.4 kn",
      "94.1 kn",
      52
    ],
    [
      "Avg Speed",
      "42.1 kn",
      "40.8 kn",
      51
    ],
    [
      "Maneuvers",
      "14",
      "15",
      48
    ],
    [
      "Foiling %",
      "92%",
      "88%",
      51
    ],
    [
      "Distance",
      "7.2 nm",
      "7.1 nm",
      51
    ],
    [
      "Penalties",
      "0",
      "1",
      67
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "aus",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "nz",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "gbr",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "fra",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "jpn",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "usa",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "Australia vs Great Britain is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "New Zealand vs United States follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "Australia vs Great Britain e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "New Zealand vs United States vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "Australia vs Great Britain es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "New Zealand vs United States sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "Australia vs Great Britain est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "New Zealand vs United States suit ensuite."
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
      "text": "Australia/Great Britain room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "New Zealand/United States pool is next on my list.",
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
      "shooterTeam": "aus",
      "keeper": "vera",
      "keeperTeam": "gbr",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "gbr",
      "keeper": "captain",
      "keeperTeam": "aus",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "aus",
      "keeper": "milo",
      "keeperTeam": "fra",
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
      "team": "aus",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "nz",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "gbr",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "den",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "fra",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/sailgp-companion.svg"
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
