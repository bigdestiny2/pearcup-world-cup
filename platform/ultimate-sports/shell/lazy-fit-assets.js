// Lazy-fit asset loader — defer heavy raster images until they are near the viewport.
//
// Usage:
//   LazyFitAssets.observe()
//   <img data-lazy-src="hero.jpg" data-lazy-srcset="hero@2x.jpg 2x" alt="…">
//
// Images with data-lazy-* are upgraded to src/srcset when they intersect a root
// margin of 200px or when the page becomes hidden/idle. The observer is cleaned
// up once all tracked images have loaded.
(function attachLazyFitAssets (root) {
  'use strict'

  const TRACKED_SELECTOR = 'img[data-lazy-src], source[data-lazy-srcset], [data-lazy-bg]'
  const MARGIN = '200px'
  const loaded = new Set()
  let observer = null

  function markModule (status) {
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.lazyFitAssetsModule = status
    }
  }

  function upgrade (el) {
    if (loaded.has(el)) return
    loaded.add(el)
    if (el.dataset.lazySrc) {
      el.src = el.dataset.lazySrc
      el.removeAttribute('data-lazy-src')
    }
    if (el.dataset.lazySrcset) {
      el.srcset = el.dataset.lazySrcset
      el.removeAttribute('data-lazy-srcset')
    }
    if (el.dataset.lazyBg) {
      el.style.backgroundImage = `url(${el.dataset.lazyBg})`
      el.removeAttribute('data-lazy-bg')
    }
    if (el.tagName === 'IMG' && el.dataset.sizes) {
      el.sizes = el.dataset.sizes
      el.removeAttribute('data-sizes')
    }
  }

  function onIntersection (entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        upgrade(entry.target)
        if (observer) observer.unobserve(entry.target)
      }
    })
    maybeDisconnect()
  }

  function maybeDisconnect () {
    if (!observer) return
    const remaining = root.document ? root.document.querySelectorAll(TRACKED_SELECTOR).length : 0
    if (remaining === 0) {
      observer.disconnect()
      observer = null
    }
  }

  function createObserver () {
    if (!root.IntersectionObserver) return null
    return new root.IntersectionObserver(onIntersection, {
      rootMargin: MARGIN,
      threshold: 0
    })
  }

  function observe () {
    if (!root.document) return
    if (!observer) observer = createObserver()
    if (!observer) {
      // No IntersectionObserver support — load everything now.
      root.document.querySelectorAll(TRACKED_SELECTOR).forEach(upgrade)
      return
    }
    root.document.querySelectorAll(TRACKED_SELECTOR).forEach(el => {
      if (loaded.has(el)) return
      observer.observe(el)
    })
  }

  function loadAll () {
    if (!root.document) return
    root.document.querySelectorAll(TRACKED_SELECTOR).forEach(upgrade)
    maybeDisconnect()
  }

  // Load all deferred assets when the tab is hidden or the page is about to unload,
  // so offline/Pear packaging has a chance to cache them.
  function onVisibility () {
    if (root.document && root.document.hidden) loadAll()
  }

  if (root.document) {
    root.document.addEventListener('visibilitychange', onVisibility)
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', observe)
    } else {
      observe()
    }
  }

  const api = {
    observe,
    loadAll,
    upgrade
  }

  root.LazyFitAssets = api
  if (typeof module !== 'undefined' && module.exports) module.exports = api

  markModule('ready')
})(typeof globalThis !== 'undefined' ? globalThis : window)
