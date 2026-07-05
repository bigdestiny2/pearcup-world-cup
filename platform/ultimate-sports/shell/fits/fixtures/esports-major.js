// Esports Major fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "esports-major",
  "title": "Esports Major",
  "subtitle": "Ultimate Sports",
  "category": "esports",
  "entrantShape": "team",
  "templateKinds": [
    "group-plus-knockout",
    "single-elimination",
    "series-playoff"
  ],
  "recommendedVariants": [
    "classic-bracket",
    "confidence",
    "survivor",
    "fantasy-lite-draft",
    "side-quest"
  ],
  "recommendedMiniGames": [
    "next-event",
    "momentum-duel",
    "trivia-duel",
    "reaction-challenge",
    "watch-party-streak"
  ],
  "defaultTeam": "t1",
  "theme": {
    "--ink": "#1e1b4b",
    "--muted": "#a897b3",
    "--soft": "#fdf2f8",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#ec4899",
    "--green-deep": "#be185d",
    "--red": "#6366f1",
    "--pink": "#6366f1",
    "--pink-deep": "#be185d",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "teams": [
    {
      "id": "t1",
      "name": "T1",
      "flag": "🎮",
      "colors": [
        "#e2012d",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "g2",
      "name": "G2",
      "flag": "🎮",
      "colors": [
        "#000000",
        "#ffffff",
        "#c8102e"
      ]
    },
    {
      "id": "fnc",
      "name": "Fnatic",
      "flag": "🎮",
      "colors": [
        "#ff5900",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "tl",
      "name": "Team Liquid",
      "flag": "🎮",
      "colors": [
        "#0c2340",
        "#ffffff",
        "#00aeef"
      ]
    },
    {
      "id": "navi",
      "name": "NAVI",
      "flag": "🎮",
      "colors": [
        "#ffee00",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "vit",
      "name": "Vitality",
      "flag": "🎮",
      "colors": [
        "#f9e300",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "c9",
      "name": "Cloud9",
      "flag": "🎮",
      "colors": [
        "#00aeef",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "sen",
      "name": "Sentinels",
      "flag": "🎮",
      "colors": [
        "#ce0e2d",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "gen",
      "name": "Gen.G",
      "flag": "🎮",
      "colors": [
        "#aa8a30",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "blg",
      "name": "Bilibili",
      "flag": "🎮",
      "colors": [
        "#00a1d6",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "faze",
      "name": "FaZe",
      "flag": "🎮",
      "colors": [
        "#ff0000",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "og",
      "name": "OG",
      "flag": "🎮",
      "colors": [
        "#002b45",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "eg",
      "name": "Evil Geniuses",
      "flag": "🎮",
      "colors": [
        "#0c1220",
        "#ffffff",
        "#d3af37"
      ]
    },
    {
      "id": "100t",
      "name": "100 Thieves",
      "flag": "🎮",
      "colors": [
        "#d31f3c",
        "#000000",
        "#ffffff"
      ]
    },
    {
      "id": "tsm",
      "name": "TSM",
      "flag": "🎮",
      "colors": [
        "#000000",
        "#ffffff",
        "#c8102e"
      ]
    },
    {
      "id": "koi",
      "name": "KOI",
      "flag": "🎮",
      "colors": [
        "#0d1b2a",
        "#ffffff",
        "#ff4d6d"
      ]
    }
  ],
  "homeFixtures": [
    {
      "status": "Today",
      "title": "T1 vs G2",
      "detail": "Round of 16 match room",
      "live": true
    },
    {
      "status": "Today",
      "title": "Fnatic vs Team Liquid",
      "detail": "Round of 16 match room",
      "live": false
    },
    {
      "status": "Today",
      "title": "NAVI vs Vitality",
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
        "t1",
        "g2"
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
        "fnc",
        "tl"
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
        "navi",
        "vit"
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
        "c9",
        "sen"
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
        "gen",
        "blg"
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
        "faze",
        "og"
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
        "eg",
        "100t"
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
        "tsm",
        "koi"
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
    "title": "T1 vs G2",
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
      "Kills",
      "18",
      "14",
      56
    ],
    [
      "Deaths",
      "8",
      "11",
      58
    ],
    [
      "Assists",
      "42",
      "36",
      54
    ],
    [
      "Objectives",
      "7",
      "4",
      64
    ],
    [
      "Gold",
      "62k",
      "58k",
      52
    ],
    [
      "Vision Score",
      "88",
      "72",
      55
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "t1",
      "score": "6/8",
      "prize": "$540"
    },
    {
      "user": "amara",
      "team": "fnc",
      "score": "5/8",
      "prize": "$360"
    },
    {
      "user": "vera",
      "team": "g2",
      "score": "5/8",
      "prize": "$270"
    },
    {
      "user": "diego",
      "team": "navi",
      "score": "4/8",
      "prize": "$195"
    },
    {
      "user": "milo",
      "team": "c9",
      "score": "4/8",
      "prize": "$140"
    },
    {
      "user": "kenji",
      "team": "tl",
      "score": "3/8",
      "prize": "$95"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "T1 vs G2 is the next Round of 16 room. Picks are open until kickoff."
      ],
      [
        "Next",
        "Fnatic vs Team Liquid follows later today."
      ],
      [
        "Bracket",
        "Pool impact is live, but the fallback feed will not invent results before they happen."
      ]
    ],
    "PT": [
      [
        "Today",
        "T1 vs G2 e a proxima sala. Palpites abertos ate o inicio."
      ],
      [
        "Next",
        "Fnatic vs Team Liquid vem depois."
      ],
      [
        "Bracket",
        "O impacto do bolao esta ativo, mas o fallback nao inventa resultados."
      ]
    ],
    "ES": [
      [
        "Today",
        "T1 vs G2 es la proxima sala. Picks abiertos hasta el inicio."
      ],
      [
        "Next",
        "Fnatic vs Team Liquid sigue mas tarde."
      ],
      [
        "Bracket",
        "El impacto del pool esta activo, pero el fallback no inventa resultados."
      ]
    ],
    "FR": [
      [
        "Today",
        "T1 vs G2 est la prochaine salle. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "Next",
        "Fnatic vs Team Liquid suit ensuite."
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
      "text": "T1/G2 room is up. No fake result until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Fnatic/Team Liquid pool is next on my list.",
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
      "shooterTeam": "t1",
      "keeper": "vera",
      "keeperTeam": "g2",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "g2",
      "keeper": "captain",
      "keeperTeam": "t1",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "t1",
      "keeper": "milo",
      "keeperTeam": "navi",
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
      "team": "t1",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "fnc",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "g2",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "vit",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "navi",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "templateData": {
    "groups": [
      {
        "name": "Group A",
        "entrants": [
          {
            "teamId": "t1",
            "name": "T1",
            "flag": "🎮",
            "played": 3,
            "wins": 2,
            "draws": 1,
            "losses": 0,
            "points": 7,
            "gd": 4
          },
          {
            "teamId": "g2",
            "name": "G2",
            "flag": "🎮",
            "played": 3,
            "wins": 1,
            "draws": 1,
            "losses": 1,
            "points": 4,
            "gd": 0
          },
          {
            "teamId": "fnc",
            "name": "Fnatic",
            "flag": "🎮",
            "played": 3,
            "wins": 1,
            "draws": 0,
            "losses": 2,
            "points": 3,
            "gd": -2
          },
          {
            "teamId": "tl",
            "name": "Team Liquid",
            "flag": "🎮",
            "played": 3,
            "wins": 0,
            "draws": 0,
            "losses": 3,
            "points": 0,
            "gd": -2
          }
        ]
      },
      {
        "name": "Group B",
        "entrants": [
          {
            "teamId": "navi",
            "name": "NAVI",
            "flag": "🎮",
            "played": 3,
            "wins": 2,
            "draws": 0,
            "losses": 1,
            "points": 6,
            "gd": 2
          },
          {
            "teamId": "vit",
            "name": "Vitality",
            "flag": "🎮",
            "played": 3,
            "wins": 1,
            "draws": 2,
            "losses": 0,
            "points": 5,
            "gd": 1
          },
          {
            "teamId": "c9",
            "name": "Cloud9",
            "flag": "🎮",
            "played": 3,
            "wins": 1,
            "draws": 1,
            "losses": 1,
            "points": 4,
            "gd": -1
          },
          {
            "teamId": "sen",
            "name": "Sentinels",
            "flag": "🎮",
            "played": 3,
            "wins": 0,
            "draws": 1,
            "losses": 2,
            "points": 1,
            "gd": -2
          }
        ]
      },
      {
        "name": "Group C",
        "entrants": [
          {
            "teamId": "gen",
            "name": "Gen.G",
            "flag": "🎮",
            "played": 3,
            "wins": 2,
            "draws": 1,
            "losses": 0,
            "points": 7,
            "gd": 3
          },
          {
            "teamId": "blg",
            "name": "Bilibili",
            "flag": "🎮",
            "played": 3,
            "wins": 2,
            "draws": 0,
            "losses": 1,
            "points": 6,
            "gd": 2
          },
          {
            "teamId": "faze",
            "name": "FaZe",
            "flag": "🎮",
            "played": 3,
            "wins": 0,
            "draws": 1,
            "losses": 2,
            "points": 1,
            "gd": -3
          },
          {
            "teamId": "og",
            "name": "OG",
            "flag": "🎮",
            "played": 3,
            "wins": 0,
            "draws": 0,
            "losses": 3,
            "points": 0,
            "gd": -2
          }
        ]
      },
      {
        "name": "Group D",
        "entrants": [
          {
            "teamId": "eg",
            "name": "Evil Geniuses",
            "flag": "🎮",
            "played": 3,
            "wins": 3,
            "draws": 0,
            "losses": 0,
            "points": 9,
            "gd": 5
          },
          {
            "teamId": "100t",
            "name": "100 Thieves",
            "flag": "🎮",
            "played": 3,
            "wins": 1,
            "draws": 1,
            "losses": 1,
            "points": 4,
            "gd": 0
          },
          {
            "teamId": "tsm",
            "name": "TSM",
            "flag": "🎮",
            "played": 3,
            "wins": 1,
            "draws": 0,
            "losses": 2,
            "points": 3,
            "gd": -2
          },
          {
            "teamId": "koi",
            "name": "KOI",
            "flag": "🎮",
            "played": 3,
            "wins": 0,
            "draws": 1,
            "losses": 2,
            "points": 1,
            "gd": -3
          }
        ]
      }
    ],
    "series": [
      {
        "id": "series-1",
        "home": "t1",
        "away": "g2",
        "homeName": "T1",
        "awayName": "G2",
        "homeWins": 2,
        "awayWins": 1,
        "needed": 4,
        "status": "In progress",
        "games": [
          {
            "number": 1,
            "homeScore": 101,
            "awayScore": 100
          },
          {
            "number": 2,
            "homeScore": 95,
            "awayScore": 107
          },
          {
            "number": 3,
            "homeScore": 98,
            "awayScore": 99
          }
        ]
      },
      {
        "id": "series-2",
        "home": "fnc",
        "away": "tl",
        "homeName": "Fnatic",
        "awayName": "Team Liquid",
        "homeWins": 1,
        "awayWins": 2,
        "needed": 4,
        "status": "In progress",
        "games": [
          {
            "number": 1,
            "homeScore": 95,
            "awayScore": 107
          },
          {
            "number": 2,
            "homeScore": 98,
            "awayScore": 99
          },
          {
            "number": 3,
            "homeScore": 104,
            "awayScore": 102
          }
        ]
      },
      {
        "id": "series-3",
        "home": "navi",
        "away": "vit",
        "homeName": "NAVI",
        "awayName": "Vitality",
        "homeWins": 3,
        "awayWins": 1,
        "needed": 4,
        "status": "In progress",
        "games": [
          {
            "number": 1,
            "homeScore": 104,
            "awayScore": 99
          },
          {
            "number": 2,
            "homeScore": 98,
            "awayScore": 107
          },
          {
            "number": 3,
            "homeScore": 95,
            "awayScore": 100
          },
          {
            "number": 4,
            "homeScore": 101,
            "awayScore": 96
          }
        ]
      },
      {
        "id": "series-4",
        "home": "c9",
        "away": "sen",
        "homeName": "Cloud9",
        "awayName": "Sentinels",
        "homeWins": 2,
        "awayWins": 0,
        "needed": 4,
        "status": "In progress",
        "games": [
          {
            "number": 1,
            "homeScore": 98,
            "awayScore": 99
          },
          {
            "number": 2,
            "homeScore": 104,
            "awayScore": 102
          }
        ]
      },
      {
        "id": "series-5",
        "home": "gen",
        "away": "blg",
        "homeName": "Gen.G",
        "awayName": "Bilibili",
        "homeWins": 1,
        "awayWins": 3,
        "needed": 4,
        "status": "In progress",
        "games": [
          {
            "number": 1,
            "homeScore": 101,
            "awayScore": 96
          },
          {
            "number": 2,
            "homeScore": 110,
            "awayScore": 102
          },
          {
            "number": 3,
            "homeScore": 104,
            "awayScore": 99
          },
          {
            "number": 4,
            "homeScore": 98,
            "awayScore": 107
          }
        ]
      },
      {
        "id": "series-6",
        "home": "faze",
        "away": "og",
        "homeName": "FaZe",
        "awayName": "OG",
        "homeWins": 2,
        "awayWins": 2,
        "needed": 4,
        "status": "In progress",
        "games": [
          {
            "number": 1,
            "homeScore": 104,
            "awayScore": 102
          },
          {
            "number": 2,
            "homeScore": 110,
            "awayScore": 96
          },
          {
            "number": 3,
            "homeScore": 101,
            "awayScore": 100
          },
          {
            "number": 4,
            "homeScore": 95,
            "awayScore": 107
          }
        ]
      },
      {
        "id": "series-7",
        "home": "eg",
        "away": "100t",
        "homeName": "Evil Geniuses",
        "awayName": "100 Thieves",
        "homeWins": 3,
        "awayWins": 0,
        "needed": 4,
        "status": "In progress",
        "games": [
          {
            "number": 1,
            "homeScore": 95,
            "awayScore": 107
          },
          {
            "number": 2,
            "homeScore": 98,
            "awayScore": 99
          },
          {
            "number": 3,
            "homeScore": 104,
            "awayScore": 102
          }
        ]
      },
      {
        "id": "series-8",
        "home": "tsm",
        "away": "koi",
        "homeName": "TSM",
        "awayName": "KOI",
        "homeWins": 0,
        "awayWins": 2,
        "needed": 4,
        "status": "In progress",
        "games": [
          {
            "number": 1,
            "homeScore": 104,
            "awayScore": 99
          },
          {
            "number": 2,
            "homeScore": 98,
            "awayScore": 107
          }
        ]
      }
    ]
  },
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/esports-major.svg"
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
