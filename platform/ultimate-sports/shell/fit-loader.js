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
    'euros-copa-america': ['penalty-clash', 'next-event', 'scoreline-lock', 'player-prop-duel', 'watch-party-streak', 'reaction-challenge'],
    'champions-league-knockout': ['penalty-clash', 'free-kick-duel', 'next-event', 'momentum-duel', 'watch-party-streak', 'reaction-challenge'],
    'march-madness': ['next-event', 'scoreline-lock', 'trivia-duel', 'peer-mini-fantasy', 'player-prop-duel', 'watch-party-streak', 'reaction-challenge', 'buzzer-beater-duel'],
    'pro-playoffs': ['next-event', 'scoreline-lock', 'player-prop-duel', 'peer-mini-fantasy', 'watch-party-streak', 'reaction-challenge', 'momentum-duel', 'buzzer-beater-duel', 'home-run-derby'],
    'tennis-grand-slams': ['next-event', 'scoreline-lock', 'player-prop-duel', 'reaction-challenge', 'watch-party-streak', 'ace-serve-duel'],
    'esports-major': ['next-event', 'momentum-duel', 'trivia-duel', 'reaction-challenge', 'watch-party-streak', 'prediction-duel'],
    'mma-boxing-fight-card': ['player-prop-duel', 'next-event', 'trivia-duel', 'reaction-challenge', 'watch-party-streak', 'momentum-duel', 'prediction-duel'],
    'sailgp-companion': ['next-event', 'momentum-duel', 'player-prop-duel', 'trivia-duel', 'reaction-challenge', 'watch-party-streak', 'peer-mini-fantasy', 'prediction-duel'],
    'creator-reality-brackets': ['trivia-duel', 'reaction-challenge', 'watch-party-streak', 'prediction-duel'],
    'awards-prediction-pools': ['trivia-duel', 'watch-party-streak', 'reaction-challenge', 'prediction-duel'],
    'local-leagues': ['penalty-clash', 'free-kick-duel', 'trivia-duel', 'next-event', 'peer-mini-fantasy', 'watch-party-streak', 'reaction-challenge', 'momentum-duel', 'player-prop-duel', 'prediction-duel']
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

  if (cfg.title) {
    root.document.title = cfg.title + (cfg.subtitle ? ' — ' + cfg.subtitle : ' — Ultimate Sports')
  }

  if (cfg.theme && root.document && root.document.documentElement) {
    const html = root.document.documentElement
    Object.entries(cfg.theme).forEach(([key, value]) => {
      html.style.setProperty(key, value)
    })
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

  function onReady () {
    try { applyBackground() } catch (e) {}
    try { addCloseButton() } catch (e) {}
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', onReady)
  } else {
    onReady()
  }
})(window)
