const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const appSource = readFileSync(join(__dirname, 'app.js'), 'utf8')
const matchSource = readFileSync(join(__dirname, 'peer-match.js'), 'utf8')

test('penalty controls use keeper language on defensive turns', () => {
  assert.match(appSource, /function setAimGridLabels \(isShoot\)/)
  assert.match(appSource, /isShoot \? 'Pick where to shoot' : 'Pick where to dive'/)
  assert.match(appSource, /\$\{isShoot \? 'Aim' : 'Dive'\}/)
  assert.match(appSource, /setAimGridLabels\(isShoot\)/)
  assert.match(matchSource, /setAimGridLabels\(iAmShooter\(\)\)/)
  assert.match(matchSource, /setAimGridLabels\(false\)/)
})

test('penalty controls are disabled until a live turn is actionable', () => {
  assert.match(appSource, /function setAimGridEnabled \(enabled\)/)
  assert.match(appSource, /button\.disabled = !enabled/)
  assert.match(appSource, /grid\.setAttribute\('aria-hidden', enabled \? 'false' : 'true'\)/)
  assert.match(appSource, /setAimGridEnabled\(true\)/)
  assert.match(appSource, /setAimGridEnabled\(false\)/)
})
