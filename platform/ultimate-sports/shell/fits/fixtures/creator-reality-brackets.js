// Reality / Creator Tournaments fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "creator-reality-brackets",
  "title": "Reality / Creator Tournaments",
  "subtitle": "Ultimate Sports",
  "category": "creator",
  "entrantShape": "creator",
  "defaultTeam": "alpha",
  "theme": {
    "--ink": "#2a0a2e",
    "--muted": "#a897b3",
    "--soft": "#fdf4ff",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#d946ef",
    "--green-deep": "#a21caf",
    "--red": "#22c55e",
    "--pink": "#22c55e",
    "--pink-deep": "#a21caf",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "alpha",
      "name": "Alpha Squad",
      "flag": "⭐",
      "colors": [
        "#d946ef",
        "#22c55e",
        "#ffffff"
      ]
    },
    {
      "id": "beta",
      "name": "Beta House",
      "flag": "⭐",
      "colors": [
        "#22c55e",
        "#d946ef",
        "#ffffff"
      ]
    },
    {
      "id": "gamma",
      "name": "Gamma Crew",
      "flag": "⭐",
      "colors": [
        "#f59e0b",
        "#ec4899",
        "#ffffff"
      ]
    },
    {
      "id": "delta",
      "name": "Delta Fam",
      "flag": "⭐",
      "colors": [
        "#3b82f6",
        "#8b5cf6",
        "#ffffff"
      ]
    },
    {
      "id": "echo",
      "name": "Echo Hive",
      "flag": "⭐",
      "colors": [
        "#ef4444",
        "#f97316",
        "#ffffff"
      ]
    },
    {
      "id": "foxy",
      "name": "Foxy Clan",
      "flag": "⭐",
      "colors": [
        "#ec4899",
        "#f59e0b",
        "#ffffff"
      ]
    },
    {
      "id": "ghost",
      "name": "Ghost Pack",
      "flag": "⭐",
      "colors": [
        "#64748b",
        "#94a3b8",
        "#ffffff"
      ]
    },
    {
      "id": "hype",
      "name": "Hype House",
      "flag": "⭐",
      "colors": [
        "#8b5cf6",
        "#06b6d4",
        "#ffffff"
      ]
    },
    {
      "id": "ivy",
      "name": "Ivy League",
      "flag": "⭐",
      "colors": [
        "#10b981",
        "#3b82f6",
        "#ffffff"
      ]
    },
    {
      "id": "jolt",
      "name": "Jolt Squad",
      "flag": "⭐",
      "colors": [
        "#f43f5e",
        "#3b82f6",
        "#ffffff"
      ]
    },
    {
      "id": "krew",
      "name": "Krew",
      "flag": "⭐",
      "colors": [
        "#eab308",
        "#ef4444",
        "#ffffff"
      ]
    },
    {
      "id": "luxe",
      "name": "Luxe Life",
      "flag": "⭐",
      "colors": [
        "#ec4899",
        "#6366f1",
        "#ffffff"
      ]
    },
    {
      "id": "muse",
      "name": "Muse Circle",
      "flag": "⭐",
      "colors": [
        "#06b6d4",
        "#d946ef",
        "#ffffff"
      ]
    },
    {
      "id": "nova",
      "name": "Nova Crew",
      "flag": "⭐",
      "colors": [
        "#f97316",
        "#eab308",
        "#ffffff"
      ]
    },
    {
      "id": "orbit",
      "name": "Orbit House",
      "flag": "⭐",
      "colors": [
        "#6366f1",
        "#22c55e",
        "#ffffff"
      ]
    },
    {
      "id": "pulse",
      "name": "Pulse Fam",
      "flag": "⭐",
      "colors": [
        "#14b8a6",
        "#f43f5e",
        "#ffffff"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "Alpha Squad vs Beta House",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "Gamma Crew vs Delta Fam",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "Echo Hive vs Foxy Clan",
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
        "alpha",
        "beta"
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
        "gamma",
        "delta"
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
        "echo",
        "foxy"
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
        "ghost",
        "hype"
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
        "ivy",
        "jolt"
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
        "krew",
        "luxe"
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
        "muse",
        "nova"
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
        "orbit",
        "pulse"
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
    "title": "Alpha Squad vs Beta House",
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
      "Votes",
      "12.4k",
      "10.1k",
      55
    ],
    [
      "Clips",
      "86",
      "72",
      54
    ],
    [
      "Streams",
      "14",
      "11",
      56
    ],
    [
      "Challenges Won",
      "5",
      "3",
      63
    ],
    [
      "Fan Power",
      "9.2",
      "7.8",
      54
    ],
    [
      "Trending",
      "#2",
      "#5",
      71
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "alpha",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "gamma",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "beta",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "echo",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "ghost",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "delta",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "Alpha Squad vs Beta House is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "Gamma Crew vs Delta Fam follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "Alpha Squad vs Beta House e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "Gamma Crew vs Delta Fam vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "Alpha Squad vs Beta House es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "Gamma Crew vs Delta Fam sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "Alpha Squad vs Beta House est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "Gamma Crew vs Delta Fam suit ensuite."
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
      "text": "Alpha Squad/Beta House room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Gamma Crew/Delta Fam pool is next on my list.",
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
      "shooterTeam": "alpha",
      "keeper": "vera",
      "keeperTeam": "beta",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "beta",
      "keeper": "captain",
      "keeperTeam": "alpha",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "alpha",
      "keeper": "milo",
      "keeperTeam": "echo",
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
      "team": "alpha",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "gamma",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "beta",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "foxy",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "echo",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/creator-reality-brackets.svg"
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
