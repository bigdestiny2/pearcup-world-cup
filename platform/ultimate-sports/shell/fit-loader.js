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

  if (cfg.title) {
    root.document.title = cfg.title + (cfg.subtitle ? ' — ' + cfg.subtitle : ' — Ultimate Sports')
  }

  if (cfg.theme && root.document && root.document.documentElement) {
    const html = root.document.documentElement
    Object.entries(cfg.theme).forEach(([key, value]) => {
      html.style.setProperty(key, value)
    })
  }

  if (cfg.background && root.document && root.document.body) {
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

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', addCloseButton)
  } else {
    try { addCloseButton() } catch (e) {}
  }
})(window)
