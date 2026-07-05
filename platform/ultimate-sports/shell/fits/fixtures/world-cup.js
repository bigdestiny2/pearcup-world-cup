// World Cup fixture
(function (root) {
  'use strict'

  const cfg = {
  "fitId": "world-cup",
  "title": "World Cup",
  "subtitle": "PearCup",
  "category": "soccer",
  "entrantShape": "team",
  "templateKinds": ["group-plus-knockout","single-elimination"],
  "defaultTeam": "br",
  "theme": {
    "--ink": "#4a3b57",
    "--muted": "#a897b3",
    "--soft": "#fff0f8",
    "--surface": "#ffffff",
    "--surface-2": "#fdf5fb",
    "--surface-3": "#f6eeff",
    "--line": "#ffd9ee",
    "--line-strong": "#f3c8e2",
    "--green": "#3fc4a8",
    "--green-deep": "#2ba98f",
    "--red": "#e56fa6",
    "--pink": "#ff8fc0",
    "--pink-deep": "#d15f96",
    "--blue": "#7cc4ff",
    "--blue-deep": "#3a90dd",
    "--grape": "#b79bff",
    "--gold": "#f0b93f",
    "--lemon": "#ffd76b"
  },
  "entrants": [
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
      "id": "jp",
      "name": "Japan",
      "flag": "🇯🇵",
      "colors": [
        "#f6f6f6",
        "#d91f3c",
        "#0a2f68"
      ]
    },
    {
      "id": "ci",
      "name": "Ivory Coast",
      "flag": "🇨🇮",
      "colors": [
        "#f27b22",
        "#ffffff",
        "#159759"
      ]
    },
    {
      "id": "no",
      "name": "Norway",
      "flag": "🇳🇴",
      "colors": [
        "#d91f3c",
        "#ffffff",
        "#143d8d"
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
      "id": "cd",
      "name": "DR Congo",
      "flag": "🇨🇩",
      "colors": [
        "#2a9bd8",
        "#f3d13d",
        "#d84a3a"
      ]
    },
    {
      "id": "ch",
      "name": "Switzerland",
      "flag": "🇨🇭",
      "colors": [
        "#d71920",
        "#ffffff",
        "#901019"
      ]
    },
    {
      "id": "dz",
      "name": "Algeria",
      "flag": "🇩🇿",
      "colors": [
        "#ffffff",
        "#00843d",
        "#d21034"
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
      "id": "hr",
      "name": "Croatia",
      "flag": "🇭🇷",
      "colors": [
        "#ffffff",
        "#d7272f",
        "#1f5aa6"
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
      "id": "at",
      "name": "Austria",
      "flag": "🇦🇹",
      "colors": [
        "#ed2939",
        "#ffffff",
        "#8f1d27"
      ]
    },
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
      "id": "ma",
      "name": "Morocco",
      "flag": "🇲🇦",
      "colors": [
        "#c1272d",
        "#006233",
        "#ffffff"
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
      "id": "sn",
      "name": "Senegal",
      "flag": "🇸🇳",
      "colors": [
        "#00853f",
        "#fdef42",
        "#e31b23"
      ]
    },
    {
      "id": "za",
      "name": "South Africa",
      "flag": "🇿🇦",
      "colors": [
        "#007749",
        "#ffb81c",
        "#de3831"
      ]
    },
    {
      "id": "py",
      "name": "Paraguay",
      "flag": "🇵🇾",
      "colors": [
        "#d52b1e",
        "#ffffff",
        "#0038a8"
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
      "id": "gh",
      "name": "Ghana",
      "flag": "🇬🇭",
      "colors": [
        "#ce1126",
        "#fcd116",
        "#006b3f"
      ]
    },
    {
      "id": "se",
      "name": "Sweden",
      "flag": "🇸🇪",
      "colors": [
        "#006aa7",
        "#fecc00",
        "#0b4f7a"
      ]
    },
    {
      "id": "au",
      "name": "Australia",
      "flag": "🇦🇺",
      "colors": [
        "#012169",
        "#ffcd00",
        "#00843d"
      ]
    },
    {
      "id": "be",
      "name": "Belgium",
      "flag": "🇧🇪",
      "colors": [
        "#000000",
        "#fae042",
        "#ed2939"
      ]
    },
    {
      "id": "ba",
      "name": "Bosnia and Herzegovina",
      "flag": "🇧🇦",
      "colors": [
        "#002395",
        "#fecb00",
        "#ffffff"
      ]
    },
    {
      "id": "eg",
      "name": "Egypt",
      "flag": "🇪🇬",
      "colors": [
        "#ce1126",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "cv",
      "name": "Cabo Verde",
      "flag": "🇨🇻",
      "colors": [
        "#003893",
        "#f7d116",
        "#cf2027"
      ]
    }
  ],
  "teams": [
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
      "id": "jp",
      "name": "Japan",
      "flag": "🇯🇵",
      "colors": [
        "#f6f6f6",
        "#d91f3c",
        "#0a2f68"
      ]
    },
    {
      "id": "ci",
      "name": "Ivory Coast",
      "flag": "🇨🇮",
      "colors": [
        "#f27b22",
        "#ffffff",
        "#159759"
      ]
    },
    {
      "id": "no",
      "name": "Norway",
      "flag": "🇳🇴",
      "colors": [
        "#d91f3c",
        "#ffffff",
        "#143d8d"
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
      "id": "cd",
      "name": "DR Congo",
      "flag": "🇨🇩",
      "colors": [
        "#2a9bd8",
        "#f3d13d",
        "#d84a3a"
      ]
    },
    {
      "id": "ch",
      "name": "Switzerland",
      "flag": "🇨🇭",
      "colors": [
        "#d71920",
        "#ffffff",
        "#901019"
      ]
    },
    {
      "id": "dz",
      "name": "Algeria",
      "flag": "🇩🇿",
      "colors": [
        "#ffffff",
        "#00843d",
        "#d21034"
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
      "id": "hr",
      "name": "Croatia",
      "flag": "🇭🇷",
      "colors": [
        "#ffffff",
        "#d7272f",
        "#1f5aa6"
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
      "id": "at",
      "name": "Austria",
      "flag": "🇦🇹",
      "colors": [
        "#ed2939",
        "#ffffff",
        "#8f1d27"
      ]
    },
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
      "id": "ma",
      "name": "Morocco",
      "flag": "🇲🇦",
      "colors": [
        "#c1272d",
        "#006233",
        "#ffffff"
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
      "id": "sn",
      "name": "Senegal",
      "flag": "🇸🇳",
      "colors": [
        "#00853f",
        "#fdef42",
        "#e31b23"
      ]
    },
    {
      "id": "za",
      "name": "South Africa",
      "flag": "🇿🇦",
      "colors": [
        "#007749",
        "#ffb81c",
        "#de3831"
      ]
    },
    {
      "id": "py",
      "name": "Paraguay",
      "flag": "🇵🇾",
      "colors": [
        "#d52b1e",
        "#ffffff",
        "#0038a8"
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
      "id": "gh",
      "name": "Ghana",
      "flag": "🇬🇭",
      "colors": [
        "#ce1126",
        "#fcd116",
        "#006b3f"
      ]
    },
    {
      "id": "se",
      "name": "Sweden",
      "flag": "🇸🇪",
      "colors": [
        "#006aa7",
        "#fecc00",
        "#0b4f7a"
      ]
    },
    {
      "id": "au",
      "name": "Australia",
      "flag": "🇦🇺",
      "colors": [
        "#012169",
        "#ffcd00",
        "#00843d"
      ]
    },
    {
      "id": "be",
      "name": "Belgium",
      "flag": "🇧🇪",
      "colors": [
        "#000000",
        "#fae042",
        "#ed2939"
      ]
    },
    {
      "id": "ba",
      "name": "Bosnia and Herzegovina",
      "flag": "🇧🇦",
      "colors": [
        "#002395",
        "#fecb00",
        "#ffffff"
      ]
    },
    {
      "id": "eg",
      "name": "Egypt",
      "flag": "🇪🇬",
      "colors": [
        "#ce1126",
        "#ffffff",
        "#000000"
      ]
    },
    {
      "id": "cv",
      "name": "Cabo Verde",
      "flag": "🇨🇻",
      "colors": [
        "#003893",
        "#f7d116",
        "#cf2027"
      ]
    }
  ],
  "fixtures": [
    {
      "status": "Today, 15:00",
      "title": "Spain vs Austria",
      "detail": "Round of 32 match room",
      "live": false
    },
    {
      "status": "Today, 19:00",
      "title": "Portugal vs Croatia",
      "detail": "$50 pool closing",
      "live": false
    },
    {
      "status": "Today, 23:00",
      "title": "Switzerland vs Algeria",
      "detail": "Late room opening",
      "live": false
    }
  ],
  "homeFixtures": [
    {
      "status": "Today, 15:00",
      "title": "Spain vs Austria",
      "detail": "Round of 32 match room",
      "live": false
    },
    {
      "status": "Today, 19:00",
      "title": "Portugal vs Croatia",
      "detail": "$50 pool closing",
      "live": false
    },
    {
      "status": "Today, 23:00",
      "title": "Switzerland vs Algeria",
      "detail": "Late room opening",
      "live": false
    }
  ],
  "round32Matches": [
    {
      "id": "r32-1",
      "time": "Sat, 06/28",
      "status": "FT",
      "slots": [
        "ca",
        "za"
      ],
      "score": [
        1,
        0
      ],
      "sample": {
        "ca": [
          "noah"
        ],
        "za": [
          "zola"
        ]
      }
    },
    {
      "id": "r32-2",
      "time": "Sun, 06/29",
      "status": "PEN 3-2",
      "slots": [
        "ma",
        "nl"
      ],
      "score": [
        1,
        1
      ],
      "sample": {
        "ma": [
          "youssef"
        ],
        "nl": [
          "daan"
        ]
      }
    },
    {
      "id": "r32-3",
      "time": "Sun, 06/29",
      "status": "FT",
      "slots": [
        "br",
        "jp"
      ],
      "score": [
        2,
        1
      ],
      "sample": {
        "br": [
          "lina",
          "ash"
        ],
        "jp": [
          "ken"
        ]
      }
    },
    {
      "id": "r32-4",
      "time": "Mon, 06/30",
      "status": "FT",
      "slots": [
        "no",
        "ci"
      ],
      "score": [
        2,
        1
      ],
      "sample": {
        "no": [
          "vera",
          "jo"
        ],
        "ci": [
          "paz"
        ]
      }
    },
    {
      "id": "r32-5",
      "time": "Sun, 06/29",
      "status": "PEN 4-3",
      "slots": [
        "py",
        "de"
      ],
      "score": [
        1,
        1
      ],
      "sample": {
        "py": [
          "santi"
        ],
        "de": [
          "fritz"
        ]
      }
    },
    {
      "id": "r32-6",
      "time": "Mon, 06/30",
      "status": "FT",
      "slots": [
        "fr",
        "se"
      ],
      "score": [
        3,
        0
      ],
      "sample": {
        "fr": [
          "cam"
        ],
        "se": [
          "ingrid"
        ]
      }
    },
    {
      "id": "r32-7",
      "time": "Mon, 06/30",
      "status": "FT",
      "slots": [
        "mx",
        "ec"
      ],
      "score": [
        2,
        0
      ],
      "sample": {
        "mx": [
          "milo"
        ],
        "ec": [
          "rio"
        ]
      }
    },
    {
      "id": "r32-8",
      "time": "Tue, 07/01",
      "status": "FT",
      "slots": [
        "eng",
        "cd"
      ],
      "score": [
        2,
        1
      ],
      "sample": {
        "eng": [
          "sasha"
        ],
        "cd": [
          "kito"
        ]
      }
    },
    {
      "id": "r32-9",
      "time": "Tue, 07/01",
      "status": "AET",
      "slots": [
        "be",
        "sn"
      ],
      "score": [
        3,
        2
      ],
      "sample": {
        "be": [
          "eline"
        ],
        "sn": [
          "amina"
        ]
      }
    },
    {
      "id": "r32-10",
      "time": "Tue, 07/01",
      "status": "FT",
      "slots": [
        "us",
        "ba"
      ],
      "score": [
        2,
        0
      ],
      "sample": {
        "us": [
          "maya"
        ],
        "ba": [
          "dado"
        ]
      }
    },
    {
      "id": "r32-11",
      "time": "Today, 15:00",
      "status": "Open",
      "slots": [
        "es",
        "at"
      ],
      "score": [
        null,
        null
      ],
      "sample": {
        "es": [
          "sol"
        ],
        "at": [
          "finn"
        ]
      }
    },
    {
      "id": "r32-12",
      "time": "Today, 19:00",
      "status": "Open",
      "slots": [
        "pt",
        "hr"
      ],
      "score": [
        null,
        null
      ],
      "sample": {
        "pt": [
          "ines"
        ],
        "hr": [
          "marko"
        ]
      }
    },
    {
      "id": "r32-13",
      "time": "Today, 23:00",
      "status": "Open",
      "slots": [
        "ch",
        "dz"
      ],
      "score": [
        null,
        null
      ],
      "sample": {
        "ch": [
          "noa"
        ],
        "dz": [
          "samir"
        ]
      }
    },
    {
      "id": "r32-14",
      "time": "Fri, 07/03, 14:00",
      "status": "Open",
      "slots": [
        "au",
        "eg"
      ],
      "score": [
        null,
        null
      ],
      "sample": {
        "au": [
          "matilda"
        ],
        "eg": [
          "omar"
        ]
      }
    },
    {
      "id": "r32-15",
      "time": "Fri, 07/03, 18:00",
      "status": "Open",
      "slots": [
        "ar",
        "cv"
      ],
      "score": [
        null,
        null
      ],
      "sample": {
        "ar": [
          "leo"
        ],
        "cv": [
          "sofia"
        ]
      }
    },
    {
      "id": "r32-16",
      "time": "Fri, 07/03, 21:30",
      "status": "Open",
      "slots": [
        "co",
        "gh"
      ],
      "score": [
        null,
        null
      ],
      "sample": {
        "co": [
          "vale"
        ],
        "gh": [
          "kwame"
        ]
      }
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
        "r32-9",
        "r32-10"
      ],
      "to": "r16-5"
    },
    {
      "from": [
        "r32-11",
        "r32-12"
      ],
      "to": "r16-6"
    },
    {
      "from": [
        "r32-13",
        "r32-14"
      ],
      "to": "r16-7"
    },
    {
      "from": [
        "r32-15",
        "r32-16"
      ],
      "to": "r16-8"
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
        "r16-5",
        "r16-6"
      ],
      "to": "qf-3"
    },
    {
      "from": [
        "r16-7",
        "r16-8"
      ],
      "to": "qf-4"
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
        "qf-3",
        "qf-4"
      ],
      "to": "sf-2"
    },
    {
      "from": [
        "sf-1",
        "sf-2"
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
    "r32-9",
    "r32-10",
    "r32-11",
    "r32-12",
    "r32-13",
    "r32-14",
    "r32-15",
    "r32-16",
    "r16-1",
    "r16-2",
    "r16-3",
    "r16-4",
    "r16-5",
    "r16-6",
    "r16-7",
    "r16-8",
    "qf-1",
    "qf-2",
    "qf-3",
    "qf-4",
    "sf-1",
    "sf-2",
    "final-1"
  ],
  "liveMatch": {
    "status": "Today, 15:00",
    "title": "Spain vs Austria",
    "detail": "Round of 32 match room",
    "live": true
  },
  "pools": [
    {
      "tier": 10,
      "entrants": 124,
      "closes": "12h",
      "max": 256,
      "prize": "$1,240",
      "heat": "Open",
      "rail": "USDT demo"
    },
    {
      "tier": 25,
      "entrants": 82,
      "closes": "9h",
      "max": 160,
      "prize": "$2,050",
      "heat": "Hot",
      "rail": "USDT demo"
    },
    {
      "tier": 50,
      "entrants": 38,
      "closes": "7h",
      "max": 96,
      "prize": "$1,900",
      "heat": "Sharp",
      "rail": "USDT demo"
    },
    {
      "tier": 100,
      "entrants": 19,
      "closes": "5h",
      "max": 64,
      "prize": "$1,900",
      "heat": "Elite",
      "rail": "USDT demo"
    }
  ],
  "matchStats": [
    [
      "Possession",
      "58%",
      "42%",
      58
    ],
    [
      "Shots",
      "12",
      "6",
      67
    ],
    [
      "xG",
      "1.82",
      "0.74",
      71
    ],
    [
      "Pass accuracy",
      "89%",
      "81%",
      62
    ],
    [
      "Corners",
      "5",
      "2",
      71
    ],
    [
      "Saves",
      "1",
      "4",
      20
    ]
  ],
  "leaders": [
    {
      "user": "lina",
      "team": "br",
      "score": "12/15",
      "prize": "$812"
    },
    {
      "user": "amara",
      "team": "ci",
      "score": "12/15",
      "prize": "$540"
    },
    {
      "user": "vera",
      "team": "no",
      "score": "11/15",
      "prize": "$410"
    },
    {
      "user": "diego",
      "team": "ar",
      "score": "11/15",
      "prize": "$305"
    },
    {
      "user": "milo",
      "team": "mx",
      "score": "10/15",
      "prize": "$190"
    },
    {
      "user": "kenji",
      "team": "jp",
      "score": "10/15",
      "prize": "$120"
    }
  ],
  "commentary": {
    "EN": [
      [
        "Today",
        "Spain vs Austria is the next Round of 32 room. Picks are open until kickoff."
      ],
      [
        "19:00Z",
        "Portugal vs Croatia follows later today, then Switzerland vs Algeria closes the slate."
      ],
      [
        "R32",
        "Pool impact is live, but the fallback feed will not invent scores before kickoff."
      ]
    ],
    "PT": [
      [
        "Today",
        "Espanha vs Austria e a proxima sala do Round of 32. Palpites abertos ate o inicio."
      ],
      [
        "19:00Z",
        "Portugal vs Croacia vem depois, e Suica vs Argelia fecha o dia."
      ],
      [
        "R32",
        "O impacto do bolao esta ativo, mas o fallback nao inventa placares antes do jogo."
      ]
    ],
    "ES": [
      [
        "Today",
        "Espana vs Austria es la proxima sala de Round of 32. Picks abiertos hasta el inicio."
      ],
      [
        "19:00Z",
        "Portugal vs Croacia sigue mas tarde, y Suiza vs Argelia cierra el dia."
      ],
      [
        "R32",
        "El impacto del pool esta activo, pero el fallback no inventa marcadores antes del partido."
      ]
    ],
    "FR": [
      [
        "Today",
        "Espagne vs Autriche est la prochaine salle du Round of 32. Picks ouverts jusqu au coup d envoi."
      ],
      [
        "19:00Z",
        "Portugal vs Croatie suit ensuite, puis Suisse vs Algerie ferme la journee."
      ],
      [
        "R32",
        "L impact du pool est actif, mais le fallback ne fabrique pas de score avant le match."
      ]
    ]
  },
  "defaultChat": [
    {
      "user": "lina",
      "text": "Spain/Austria room is up. No fake score until the feed lands.",
      "time": "Today"
    },
    {
      "user": "vera",
      "text": "Portugal/Croatia pool is next on my list.",
      "time": "19:00Z"
    },
    {
      "user": "ash",
      "text": "Good, bracket is still Round of 32.",
      "time": "R32"
    }
  ],
  "gameRounds": [
    {
      "shooter": "captain",
      "shooterTeam": "br",
      "keeper": "vera",
      "keeperTeam": "no",
      "aim": "right-high",
      "dive": "right-high",
      "power": 3,
      "curve": 1,
      "releaseTick": 42,
      "keeperTick": 43
    },
    {
      "shooter": "vera",
      "shooterTeam": "no",
      "keeper": "captain",
      "keeperTeam": "br",
      "aim": "left-low",
      "dive": "center-low",
      "power": 4,
      "curve": -1,
      "releaseTick": 39,
      "keeperTick": 41
    },
    {
      "shooter": "captain",
      "shooterTeam": "br",
      "keeper": "milo",
      "keeperTeam": "mx",
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
      "team": "br",
      "record": "4-1",
      "trust": "99.2%"
    },
    {
      "user": "freya",
      "team": "hr",
      "record": "4-1",
      "trust": "98.9%"
    },
    {
      "user": "vera",
      "team": "no",
      "record": "3-2",
      "trust": "98.7%"
    },
    {
      "user": "kwame",
      "team": "ci",
      "record": "3-2",
      "trust": "98.1%"
    },
    {
      "user": "milo",
      "team": "mx",
      "record": "3-2",
      "trust": "97.9%"
    }
  ],
  "assets": {
    "heroBackdrop": "../generated/fit-heroes/world-cup.svg"
  }
}

  if (typeof root !== 'undefined' && typeof root.registerFit === 'function') {
    root.registerFit(cfg.fitId, cfg)
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = cfg
  }
})(typeof window !== 'undefined' ? window : globalThis)
