'use strict'

function canonicalJson (value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function hash32 (value) {
  const text = typeof value === 'string' ? value : canonicalJson(value)
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function slugify (value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stableId (prefix, parts) {
  const normalizedPrefix = slugify(prefix || 'id') || 'id'
  const suffix = hash32(parts).slice(0, 10)
  return `${normalizedPrefix}-${suffix}`
}

function assertNonEmptyString (value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`)
  }
}

function assertAllowed (value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new RangeError(`${label} must be one of: ${allowed.join(', ')}`)
  }
}

function ensureArray (value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`)
  return value
}

function cloneJson (value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

module.exports = {
  canonicalJson,
  hash32,
  slugify,
  stableId,
  assertNonEmptyString,
  assertAllowed,
  ensureArray,
  cloneJson
}

