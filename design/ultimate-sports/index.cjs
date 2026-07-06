'use strict'
/** @typedef {import('pear-interface')} */ /* global Pear */

const Runtime = require('pear-electron')
const Bridge = require('pear-bridge')

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
  console.error('[ultimate-sports] fatal', err)
  if (typeof Pear !== 'undefined' && typeof Pear.exit === 'function') Pear.exit(1)
  else process.exitCode = 1
})
