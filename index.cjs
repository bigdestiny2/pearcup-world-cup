'use strict'
/** @typedef {import('pear-interface')} */ /* global Pear */

if (!legacyRootPearAllowed()) {
  console.error('[pearcup-world-cup] root Pear package is legacy and intentionally disabled. Use `npm run dev` from the repo root, or `cd design/kawaii-app && pear run --dev .`, to launch the canonical PearCup app.')
  if (typeof Pear !== 'undefined' && typeof Pear.exit === 'function') Pear.exit(1)
  else process.exitCode = 1
} else {
  main().catch((err) => {
    console.error('[pearcup-world-cup] fatal', err)
    if (typeof Pear !== 'undefined' && typeof Pear.exit === 'function') Pear.exit(1)
    else process.exitCode = 1
  })
}

function legacyRootPearAllowed () {
  const env =
    (typeof process !== 'undefined' && process && process.env) ||
    (typeof Pear !== 'undefined' && Pear.config && Pear.config.env) ||
    {}
  return ['1', 'true', 'yes'].includes(String(env.PEARCUP_ALLOW_LEGACY_ROOT || '').toLowerCase())
}

async function main () {
  const Runtime = require('pear-electron')
  const Bridge = require('pear-bridge')
  const runtime = new Runtime()
  const bridge = new Bridge()
  await bridge.ready()

  const pipe = runtime.start({ bridge })
  if (typeof Pear !== 'undefined' && Pear.teardown) {
    Pear.teardown(() => pipe.end())
  }
}
