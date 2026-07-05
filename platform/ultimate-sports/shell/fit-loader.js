// Ultimate Sports fit loader — runs synchronously before the kawaii tournament shell boots.
// It picks a fit from the query string or from window.ULTIMATE_SPORTS_FIT,
// applies the fit's theme tokens, sets the document title, and exposes the
// resolved config as window.ULTIMATE_FIT_CONFIG so shell/app.js can override defaults.
// Unknown or missing fit parameters fall back safely to the world-cup fit.
(function (root) {
  'use strict'

  function safeSearch (root) {
    try {
      const loc = root.location || {}
      if (typeof root.URLSearchParams === 'function' && typeof loc.search === 'string') {
        return new root.URLSearchParams(loc.search)
      }
    } catch (e) {}
    return null
  }

  const params = safeSearch(root)
  const requestedFitId = (root.ULTIMATE_SPORTS_FIT || (params && params.get('fit')) || 'world-cup').trim()
  const configs = root.ULTIMATE_FIT_REGISTRY || {}
  const fallbackFitId = 'world-cup'

  // Resolve to a known fit; anything unknown or empty falls back to world-cup.
  const resolvedFitId = (requestedFitId && configs[requestedFitId]) ? requestedFitId : fallbackFitId
  const cfg = configs[resolvedFitId] || configs[fallbackFitId] || {}

  // Always expose a consistent config object with the resolved fitId.
  root.CURRENT_FIT_ID = resolvedFitId
  root.ULTIMATE_FIT_CONFIG = Object.assign({}, cfg, { fitId: resolvedFitId })

  // Mark the loader as complete so the shell and tests can observe ordering.
  root.__ULTIMATE_FIT_LOADER_READY = true
  try {
    if (typeof root.dispatchEvent === 'function') {
      root.dispatchEvent(new root.Event('ultimate-fit-loader:ready'))
    }
  } catch (e) {}

  function safeDocument () {
    try { return root.document } catch (e) { return null }
  }

  const doc = safeDocument()

  if (cfg.title && doc) {
    try {
      doc.title = cfg.title + (cfg.subtitle ? ' — ' + cfg.subtitle : ' — Ultimate Sports')
    } catch (e) {}
  }

  if (cfg.theme && doc && doc.documentElement && doc.documentElement.style) {
    try {
      const html = doc.documentElement
      Object.entries(cfg.theme).forEach(([key, value]) => {
        html.style.setProperty(key, value)
      })
    } catch (e) {}
  }

  if (cfg.background && doc && doc.body && doc.body.classList && doc.body.style) {
    try {
      doc.body.classList.add('fit-dark')
      doc.body.style.background = cfg.background
    } catch (e) {}
  }

  // When the shell is embedded in the Ultimate Sports lobby, add a close button
  // that asks the parent to close the app loader.
  function addCloseButton () {
    if (root.self === root.top) return
    const header = doc.querySelector('.topbar')
    if (!header || header.querySelector('.shell-close-btn')) return
    const btn = doc.createElement('button')
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

  if (!doc) return

  try {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', addCloseButton)
    } else {
      addCloseButton()
    }
  } catch (e) {}
})(window)
