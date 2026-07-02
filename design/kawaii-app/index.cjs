'use strict'
/** @typedef {import('pear-interface')} */ /* global Pear */

const Runtime = require('pear-electron')
const Bridge = require('pear-bridge')

// Pull the P2P stack into the dependency graph so `pear stage` bundles it for the
// swarm worker (swarm-worker.cjs is spawned by path via Pear.worker.run at runtime,
// so its own requires aren't traced from the renderer). Loaded but unused here.
require('hyperswarm')
require('hypercore-crypto')
require('b4a')

async function main () {
  const runtime = new Runtime()
  const bridge = new Bridge()
  await bridge.ready()

  const pipe = runtime.start({ bridge })
  if (typeof Pear !== 'undefined' && Pear.teardown) {
    Pear.teardown(() => pipe.end())
  }
}

main().catch((err) => {
  console.error('[pearcup-world-cup] fatal', err)
  if (typeof Pear !== 'undefined' && typeof Pear.exit === 'function') Pear.exit(1)
  else process.exitCode = 1
})

