'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8')

function primaryNavViews () {
  const nav = html.match(/<nav class="topnav"[\s\S]*?<\/nav>/)
  assert.ok(nav, 'primary navigation is present')
  return [...new Set([...nav[0].matchAll(/data-view="([^"]+)"/g)].map(match => match[1]))]
}

test('primary navigation points to implemented screens', () => {
  const views = primaryNavViews()
  assert.deepEqual(views, [
    'onboarding',
    'home',
    'discover',
    'creator',
    'picks',
    'bracket',
    'watch',
    'games',
    'wallet',
    'ops'
  ])

  const missingScreens = views.filter(view => !new RegExp(`<section[^>]+id="${view}"`).test(html))
  assert.deepEqual(missingScreens, [])
})

test('ultimate sports screens have renderer mount points and render functions', () => {
  const mountIds = [
    'eventTemplateGrid',
    'templateStackPanel',
    'creatorSteps',
    'creatorStackPreview',
    'pickModeGrid',
    'pickDetailPanel',
    'walletSummary',
    'walletReadiness',
    'opsHealth',
    'opsResults'
  ]
  const missingMounts = mountIds.filter(id => !html.includes(`id="${id}"`))
  assert.deepEqual(missingMounts, [])

  const renderers = [
    'function renderDiscover',
    'function renderCreator',
    'function renderPicksWorkbench',
    'function renderWallet',
    'function renderOps'
  ]
  const missingRenderers = renderers.filter(name => !app.includes(name))
  assert.deepEqual(missingRenderers, [])

  for (const call of ['renderDiscover()', 'renderCreator()', 'renderPicksWorkbench()', 'renderWallet()', 'renderOps()']) {
    assert.ok(app.includes(call), `${call} is called from renderAll`)
  }
})

test('view navigation and live feeds expose accessibility state', () => {
  assert.ok(app.includes('aria-current'), 'active primary nav exposes aria-current')
  assert.ok(html.includes('role="tablist" aria-label="Live menu"'), 'live menu is a tablist')
  assert.ok(app.includes('role="tab"'), 'dynamic tabs expose tab role')
  assert.ok(app.includes('aria-selected'), 'dynamic tabs expose selected state')
  assert.ok(html.includes('role="log" aria-live="polite" aria-label="QVAC commentary updates"'), 'commentary feed is a live log')
  assert.ok(html.includes('role="log" aria-live="polite" aria-label="Room chat messages"'), 'chat feed is a live log')
  assert.ok(html.includes('<label class="sr-only" for="chatInput">Message the room</label>'), 'chat input has a label')
})
