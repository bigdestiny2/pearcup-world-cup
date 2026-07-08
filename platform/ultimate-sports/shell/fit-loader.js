// Ultimate Sports fit loader — runs before the kawaii tournament shell boots.
// It picks a fit from the query string or from window.ULTIMATE_SPORTS_FIT,
// applies the fit's theme tokens, sets the document title, and exposes the
// config as window.ULTIMATE_FIT_CONFIG so shell/app.js can override defaults.
(function (root) {
  'use strict'

  const params = new URLSearchParams(root.location.search)
  const fitId = root.ULTIMATE_SPORTS_FIT || params.get('fit') || 'world-cup'
  const configs = root.ULTIMATE_FIT_REGISTRY || {}
  const cfg = configs[fitId] || configs['world-cup'] || {}

  root.CURRENT_FIT_ID = fitId
  root.ULTIMATE_FIT_CONFIG = cfg

  // Expose the fit's recommended mini-games and human-readable titles for the
  // browser shell. Mirrors src/catalog-engine.js so the Games lobby and watch
  // challenge tray can show fit-appropriate games.
  const RECOMMENDED_MINI_GAMES = {
    'world-cup': ['penalty-clash', 'free-kick-duel', 'next-event', 'scoreline-lock', 'watch-party-streak', 'reaction-challenge'],
    'euros-copa-america': ['penalty-clash', 'free-kick-duel', 'next-event', 'scoreline-lock', 'player-prop-duel', 'watch-party-streak', 'reaction-challenge'],
    'champions-league-knockout': ['penalty-clash', 'free-kick-duel', 'next-event', 'momentum-duel', 'watch-party-streak', 'reaction-challenge'],
    'march-madness': ['next-event', 'scoreline-lock', 'trivia-duel', 'peer-mini-fantasy', 'player-prop-duel', 'watch-party-streak', 'reaction-challenge', 'buzzer-beater-duel'],
    'pro-playoffs': ['next-event', 'scoreline-lock', 'player-prop-duel', 'peer-mini-fantasy', 'watch-party-streak', 'reaction-challenge', 'momentum-duel', 'buzzer-beater-duel', 'home-run-derby'],
    'tennis-grand-slams': ['next-event', 'scoreline-lock', 'player-prop-duel', 'reaction-challenge', 'watch-party-streak', 'ace-serve-duel'],
    'esports-major': ['next-event', 'momentum-duel', 'trivia-duel', 'reaction-challenge', 'watch-party-streak', 'prediction-duel'],
    'mma-boxing-fight-card': ['player-prop-duel', 'next-event', 'trivia-duel', 'reaction-challenge', 'watch-party-streak', 'momentum-duel', 'prediction-duel'],
    'sailgp-companion': ['next-event', 'momentum-duel', 'player-prop-duel', 'trivia-duel', 'reaction-challenge', 'watch-party-streak', 'peer-mini-fantasy', 'prediction-duel'],
    'creator-reality-brackets': ['trivia-duel', 'reaction-challenge', 'watch-party-streak', 'prediction-duel'],
    'awards-prediction-pools': ['trivia-duel', 'watch-party-streak', 'reaction-challenge', 'prediction-duel'],
    'local-leagues': ['penalty-clash', 'free-kick-duel', 'trivia-duel', 'next-event', 'peer-mini-fantasy', 'watch-party-streak', 'reaction-challenge', 'momentum-duel', 'player-prop-duel', 'prediction-duel', 'buzzer-beater-duel', 'ace-serve-duel', 'home-run-derby']
  }
  root.ULTIMATE_TRIVIA_BANK = {
    'world-cup': [
      { id: 'wc-1', question: 'Which country has won the most FIFA Men\'s World Cups?', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'wc-2', question: 'How many players start a soccer match for one team?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'wc-3', question: 'What is the maximum length of a World Cup half?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'wc-4', question: 'Which color card means a player is sent off?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'wc-5', question: 'A penalty kick is taken from how many yards?', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'wc-6', question: 'Which nation hosted the first World Cup in 1930?', options: ['A', 'B', 'C', 'D'], answer: 'C' }
    ],
    'euros-copa-america': [
      { id: 'eca-1', question: 'Which nation has won the most UEFA European Championships?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'eca-2', question: 'The first Copa América was held in which year?', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'eca-3', question: 'Copa América is contested by teams from which continent?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'eca-4', question: 'How many minutes is a standard Euro match half?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'eca-5', question: 'Which country has hosted the Euros the most times?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'eca-6', question: 'A shootout in the Euros starts with how many penalties each?', options: ['A', 'B', 'C', 'D'], answer: 'B' }
    ],
    'champions-league-knockout': [
      { id: 'clk-1', question: 'Which club has won the most UEFA Champions League titles?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'clk-2', question: 'How many teams reach the Champions League knockout phase?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'clk-3', question: 'The Champions League anthem is played before every match.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'clk-4', question: 'Knockout ties are decided over how many legs?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'clk-5', question: 'What shape is the Champions League trophy?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'clk-6', question: 'Which Italian club is nicknamed I Rossoneri?', options: ['A', 'B', 'C', 'D'], answer: 'A' }
    ],
    'march-madness': [
      { id: 'mm-1', question: 'How many teams make the NCAA men\'s basketball tournament?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'mm-2', question: 'A March Madness region has how many teams?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'mm-3', question: 'What is a 12-seed beating a 5-seed famously called?', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'mm-4', question: 'How many wins are needed to win the tournament?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'mm-5', question: 'The Final Four is played on which weekend?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'mm-6', question: 'Which conference has the most all-time tournament titles?', options: ['A', 'B', 'C', 'D'], answer: 'B' }
    ],
    'pro-playoffs': [
      { id: 'pp-1', question: 'How many teams reach the NFL playoffs?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'pp-2', question: 'The NBA Finals are a best-of-how-many series?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'pp-3', question: 'How many innings are in a regulation MLB playoff game?', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'pp-4', question: 'Which trophy is awarded to the NHL champion?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'pp-5', question: 'A touchdown in the NFL is worth how many points?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'pp-6', question: 'The Super Bowl is typically played in which month?', options: ['A', 'B', 'C', 'D'], answer: 'C' }
    ],
    'tennis-grand-slams': [
      { id: 'tgs-1', question: 'Which Grand Slam is played on clay?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'tgs-2', question: 'How many sets does a man need to win a Slam final?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'tgs-3', question: 'Which Slam is the oldest tennis tournament?', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'tgs-4', question: 'A tiebreak is first to how many points?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'tgs-5', question: 'Which city hosts the US Open?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'tgs-6', question: 'A Grand Slam event is also known as a major.', options: ['A', 'B', 'C', 'D'], answer: 'A' }
    ],
    'esports-major': [
      { id: 'esm-1', question: 'Which title is a MOBA esport?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'esm-2', question: 'CS2 is played in which perspective?', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'esm-3', question: 'How many players are on a standard VALORANT team?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'esm-4', question: 'Dota 2\'s biggest annual event is called The International.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'esm-5', question: 'Which game is a team-based hero shooter?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'esm-6', question: 'A Rocket League team fields how many cars?', options: ['A', 'B', 'C', 'D'], answer: 'B' }
    ],
    'mma-boxing-fight-card': [
      { id: 'mb-1', question: 'How many rounds are in a championship boxing match?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'mb-2', question: 'An MMA bout can end by submission.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'mb-3', question: 'Which is a legal MMA striking surface?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'mb-4', question: 'A boxing ring has how many ropes?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'mb-5', question: 'The UFC heavyweight limit is 265 pounds.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'mb-6', question: 'Which martial art is central to Brazilian Jiu-Jitsu?', options: ['A', 'B', 'C', 'D'], answer: 'B' }
    ],
    'sailgp-companion': [
      { id: 'sg-1', question: 'SailGP boats are high-speed catamarans.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'sg-2', question: 'SailGP races take place on water and in the air.', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'sg-3', question: 'Which nation won the inaugural SailGP season?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'sg-4', question: 'The F50 can foil above the water on hydrofoils.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'sg-5', question: 'A SailGP event typically has how many fleet races?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'sg-6', question: 'Which city hosted the first SailGP event?', options: ['A', 'B', 'C', 'D'], answer: 'B' }
    ],
    'creator-reality-brackets': [
      { id: 'cr-1', question: 'Reality bracket winners are usually decided by fan votes.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'cr-2', question: 'A creator reality bracket often pits personalities head-to-head.', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'cr-3', question: 'Which format is most like a reality bracket?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'cr-4', question: 'Live polls are common tools for reality bracket voting.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'cr-5', question: 'Reality brackets usually require athletic skill.', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'cr-6', question: 'Which phrase fits a creator bracket upset?', options: ['A', 'B', 'C', 'D'], answer: 'B' }
    ],
    'awards-prediction-pools': [
      { id: 'aw-1', question: 'Which award honors Best Picture?', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'aw-2', question: 'The Grammys primarily recognize achievements in music.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'aw-3', question: 'Which award show honors television?', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'aw-4', question: 'A prediction pool asks you to forecast winners.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'aw-5', question: 'The Tony Awards celebrate excellence in theater.', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'aw-6', question: 'Which is a common awards prediction tiebreaker?', options: ['A', 'B', 'C', 'D'], answer: 'D' }
    ],
    'local-leagues': [
      { id: 'll-1', question: 'A local league season usually ends with playoffs.', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      { id: 'll-2', question: 'Local leagues often use a round-robin schedule.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'll-3', question: 'Which is a common local soccer match length?', options: ['A', 'B', 'C', 'D'], answer: 'C' },
      { id: 'll-4', question: 'A league table ranks teams by points.', options: ['A', 'B', 'C', 'D'], answer: 'A' },
      { id: 'll-5', question: 'How many points is a win usually worth?', options: ['A', 'B', 'C', 'D'], answer: 'D' },
      { id: 'll-6', question: 'Local league venues are typically community fields.', options: ['A', 'B', 'C', 'D'], answer: 'B' }
    ]
  }
  root.ULTIMATE_PREDICTION_OPTIONS = {
    'world-cup': ['Home win', 'Away win', 'Draw', 'Over 2.5 goals', 'Under 2.5 goals', 'Penalty shootout'],
    'mma-boxing-fight-card': ['KO/TKO', 'Submission', 'Decision', 'Draw', 'Round 1-2', 'Round 3+'],
    'awards-prediction-pools': ['Best Picture upset', 'Major sweep', 'Split major awards', 'Speech mention'],
    'march-madness': ['Buzzer beater', 'Overtime', 'Blowout', 'Upset'],
    'esports-major': ['Home team wins', 'Away team wins', 'Overtime', 'Clutch ace'],
    'default': ['Option A', 'Option B', 'Option C', 'Option D']
  }
  root.ULTIMATE_MINI_GAME_TITLES = {
    'penalty-clash': 'Penalty Clash',
    'trivia-duel': 'Trivia Duel',
    'prediction-duel': 'Prediction Duel',
    'free-kick-duel': 'Free-kick Duel',
    'next-event': 'Next Event',
    'scoreline-lock': 'Scoreline Lock',
    'player-prop-duel': 'Player Prop Duel',
    'momentum-duel': 'Momentum Duel',
    'watch-party-streak': 'Watch-party Streak',
    'reaction-challenge': 'Reaction Challenge',
    'peer-mini-fantasy': 'Peer Mini Fantasy',
    'buzzer-beater-duel': 'Buzzer Beater Duel',
    'ace-serve-duel': 'Ace Serve Duel',
    'home-run-derby': 'Home Run Derby'
  }
  cfg.recommendedMiniGames = RECOMMENDED_MINI_GAMES[fitId] || RECOMMENDED_MINI_GAMES['world-cup']
  cfg.predictionOptions = root.ULTIMATE_PREDICTION_OPTIONS[fitId] || root.ULTIMATE_PREDICTION_OPTIONS['default']
  cfg.triviaQuestions = root.ULTIMATE_TRIVIA_BANK[fitId] || root.ULTIMATE_TRIVIA_BANK['world-cup']

  if (cfg.title) {
    root.document.title = cfg.title + (cfg.subtitle ? ' — ' + cfg.subtitle : ' — Ultimate Sports')
  }

  if (cfg.theme && root.document && root.document.documentElement) {
    const html = root.document.documentElement
    Object.entries(cfg.theme).forEach(([key, value]) => {
      html.style.setProperty(key, value)
    })
  }

  // ---- P2P-client identity: expose the server's accent ---------------------
  // Every server opens into the SAME window-chrome client (matching the lobby);
  // the neutral light-client STRUCTURE (surface/line/ink/radius) is forced in
  // client-skin.css with !important so it beats the fit's — and app.js's own —
  // inline theme. Here we only surface each fit's ACCENT color as the server's
  // identity, used for chrome highlights (nav, primary actions, brand mark).
  if (root.document && root.document.documentElement) {
    const accent = (cfg.theme && (cfg.theme['--green'] || cfg.theme['--blue'] || cfg.theme['--pink'])) || '#3fc4a8'
    root.document.documentElement.style.setProperty('--server-accent', accent)
  }

  // ---- Street Fighter arcade theme (fits with an `arcade` block) ----------
  // The combat fit ships an `arcade` block (fighters, records, colors). We add a
  // `fit-arcade` class (arcade-skin CSS keys off it) and inject a VS screen into
  // the home hero, re-mounting on re-render via a MutationObserver.
  if (cfg.arcade && root.document && root.document.documentElement) {
    root.ULTIMATE_ARCADE = cfg.arcade
    root.document.documentElement.classList.add('fit-arcade')
  }

  function arcadeEsc (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  // HD fighter portrait (Higgsfield-generated), one per corner.
  function arcadeFighter (f, side) {
    const img = side === 'red' ? 'avatars/fighter-red.png' : 'avatars/fighter-green.png'
    return '<img class="av-portrait" src="' + img + '" alt="' + arcadeEsc(f.last) + '" decoding="async">'
  }

  function arcadeFighterCol (f, side) {
    return '<div class="av-fighter av-' + side + '" style="--fc:' + arcadeEsc(f.color) + ';--fc2:' + arcadeEsc(f.color2) + '">' +
      '<div class="av-health"><span class="av-hlabel">' + arcadeEsc(f.country) + '</span><i></i></div>' +
      '<div class="av-figwrap">' + arcadeFighter(f, side) + '</div>' +
      '<div class="av-plate">' +
        '<div class="av-nick">"' + arcadeEsc(f.nick) + '"</div>' +
        '<div class="av-name"><span class="av-flag">' + f.flag + '</span>' + arcadeEsc(f.last) + '</div>' +
        '<div class="av-rec">' + arcadeEsc(f.first) + ' · ' + arcadeEsc(f.record) + ' · ' + arcadeEsc(f.hometown) + '</div>' +
      '</div>' +
    '</div>'
  }

  function arcadeVsHtml () {
    const a = cfg.arcade
    return '<div class="arcade-vs" role="img" aria-label="' + arcadeEsc(a.event) + '">' +
      '<div class="av-scan" aria-hidden="true"></div>' +
      '<div class="av-top"><span class="av-promo">' + arcadeEsc(a.promotion) + '</span><span class="av-meta">' + arcadeEsc(a.weightClass) + ' · ' + arcadeEsc(a.rounds) + ' ROUNDS</span></div>' +
      '<div class="av-stage">' + arcadeFighterCol(a.red, 'red') + '<div class="av-vs" aria-hidden="true"><span>VS</span></div>' + arcadeFighterCol(a.blue, 'blue') + '</div>' +
      '<div class="av-bottom"><span class="av-venue">' + arcadeEsc(a.venue) + '</span><button class="av-fightbtn" type="button">&#9654; ENTER THE FIGHT POOL</button></div>' +
    '</div>'
  }

  function mountArcadeVs () {
    if (!cfg.arcade || !root.document) return
    const host = root.document.querySelector('#home .live-command')
    if (!host || host.querySelector('.arcade-vs')) return
    const wrap = root.document.createElement('div')
    wrap.innerHTML = arcadeVsHtml()
    const el = wrap.firstElementChild
    if (!el) return
    host.insertBefore(el, host.firstChild)
    const btn = el.querySelector('.av-fightbtn')
    if (btn) {
      btn.addEventListener('click', function () {
        const nav = root.document.querySelector('.topnav [data-view="bracket"]')
        if (nav) nav.click()
      })
    }
  }

  // Turn the watch-party stadium into a fight broadcast (HD portraits facing
  // off) instead of the soccer pitch.
  function mountArcadeBroadcast () {
    if (!cfg.arcade || !root.document) return
    const tv = root.document.querySelector('#watch .stadium-tv')
    if (!tv || tv.querySelector('.tv-fight')) return
    const a = cfg.arcade
    const el = root.document.createElement('div')
    el.className = 'tv-fight'
    el.innerHTML =
      '<div class="tvf-fighter tvf-red"><img src="avatars/fighter-red.png" alt="" decoding="async"></div>' +
      '<div class="tvf-center"><span class="tvf-live">◉ LIVE</span><span class="tvf-vs">VS</span><span class="tvf-tale">' + arcadeEsc(a.weightClass) + '</span></div>' +
      '<div class="tvf-fighter tvf-blue"><img src="avatars/fighter-green.png" alt="" decoding="async"></div>'
    tv.insertBefore(el, tv.firstChild)
  }

  function mountArcade () {
    try { mountArcadeVs() } catch (e) {}
    try { mountArcadeBroadcast() } catch (e) {}
  }

  function observeArcade () {
    if (!cfg.arcade || !root.MutationObserver || !root.document) return
    const screens = root.document.querySelector('.screens') || root.document.body
    if (!screens) return
    const obs = new root.MutationObserver(function () { try { mountArcade() } catch (e) {} })
    obs.observe(screens, { childList: true, subtree: true })
  }

  // This script runs in <head>, so document.body may not exist yet — defer the
  // body-level theming (dark background / fit-dark class) until the body is ready.
  function applyBackground () {
    if (!cfg.background || !root.document || !root.document.body) return
    root.document.body.classList.add('fit-dark')
    root.document.body.style.background = cfg.background
  }

  // When the shell is embedded in the Ultimate Sports lobby, add a close button
  // that asks the parent to close the app loader.
  function addCloseButton () {
    if (root.self === root.top) return
    const header = root.document.querySelector('.topbar')
    if (!header || header.querySelector('.shell-close-btn')) return
    const btn = root.document.createElement('button')
    btn.type = 'button'
    btn.className = 'shell-close-btn'
    btn.setAttribute('aria-label', 'Back to lobby')
    btn.innerHTML = '<span>← Lobby</span>'
    btn.style.cssText = 'margin-left:auto;min-height:36px;padding:0 14px;border:1px solid var(--line-strong);border-radius:999px;background:rgba(255,255,255,.9);color:var(--ink);font-weight:800;font-size:13px;cursor:pointer;'
    btn.addEventListener('click', () => {
      root.parent.postMessage({ type: 'close-app' }, '*')
    })
    header.appendChild(btn)
  }

  // Name the window after the server, like a real client titlebar.
  function applyWindowTitle () {
    const sub = root.document.getElementById('winSubtitle')
    if (sub && cfg.title) sub.textContent = '— ' + cfg.title
    const tick = root.document.getElementById('shellTicker')
    if (tick && cfg.subtitle) tick.textContent = 'connected · ' + cfg.subtitle + ' · syncing room state…'
  }

  function onReady () {
    try { applyBackground() } catch (e) {}
    try { addCloseButton() } catch (e) {}
    try { applyWindowTitle() } catch (e) {}
    try { mountArcade() } catch (e) {}
    try { observeArcade() } catch (e) {}
    try { root.addEventListener('pearcup:booted', function () { try { mountArcade() } catch (e) {} }) } catch (e) {}
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', onReady)
  } else {
    onReady()
  }
})(window)
