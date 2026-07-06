#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const COVER_DIR = path.join(ROOT, 'generated-assets', 'fit-covers')
const HERO_DIR = path.join(ROOT, 'generated-assets', 'fit-heroes')

const fits = [
  { id: 'world-cup', title: 'World Cup', icon: '🏆', primary: '#139b49', secondary: '#ffd447', accent: '#1b55a5', dark: false },
  { id: 'euros-copa-america', title: 'Euros / Copa', icon: '🌍', primary: '#3b82f6', secondary: '#ef4444', accent: '#1d4ed8', dark: false },
  { id: 'champions-league-knockout', title: 'Champions League', icon: '⭐', primary: '#0ea5e9', secondary: '#f59e0b', accent: '#0369a1', dark: true },
  { id: 'march-madness', title: 'March Madness', icon: '🏀', primary: '#f97316', secondary: '#3b82f6', accent: '#c2410c', dark: false },
  { id: 'pro-playoffs', title: 'Pro Playoffs', icon: '🏆', primary: '#8b5cf6', secondary: '#f43f5e', accent: '#6d28d9', dark: true },
  { id: 'tennis-grand-slams', title: 'Grand Slams', icon: '🎾', primary: '#10b981', secondary: '#f59e0b', accent: '#047857', dark: false },
  { id: 'esports-major', title: 'Esports Major', icon: '🎮', primary: '#ec4899', secondary: '#6366f1', accent: '#be185d', dark: true },
  { id: 'mma-boxing-fight-card', title: 'Fight Cards', icon: '🥊', primary: '#ef4444', secondary: '#3b82f6', accent: '#b91c1c', dark: true },
  { id: 'sailgp-companion', title: 'SailGP', icon: '⛵', primary: '#06b6d4', secondary: '#f43f5e', accent: '#0e7490', dark: true },
  { id: 'creator-reality-brackets', title: 'Creator Brackets', icon: '⭐', primary: '#d946ef', secondary: '#22c55e', accent: '#a21caf', dark: true },
  { id: 'awards-prediction-pools', title: 'Awards Night', icon: '🎬', primary: '#f59e0b', secondary: '#ec4899', accent: '#b45309', dark: true },
  { id: 'local-leagues', title: 'Local Leagues', icon: '⚽', primary: '#22c55e', secondary: '#3b82f6', accent: '#15803d', dark: false }
]

function svgCover (fit) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${fit.primary}" stop-opacity=".95"/>
      <stop offset="55%" stop-color="${fit.accent}" stop-opacity=".92"/>
      <stop offset="100%" stop-color="${fit.secondary}" stop-opacity=".88"/>
    </linearGradient>
  </defs>
  <rect width="800" height="400" rx="36" fill="url(#g)"/>
  <circle cx="680" cy="120" r="160" fill="#ffffff" opacity=".08"/>
  <circle cx="120" cy="320" r="120" fill="#ffffff" opacity=".06"/>
  <text x="60" y="210" font-size="140" font-family="Arial, sans-serif">${fit.icon}</text>
  <text x="60" y="300" font-size="36" font-weight="900" fill="#ffffff" font-family="ui-rounded, system-ui, sans-serif" letter-spacing="-0.02em">${escapeXml(fit.title)}</text>
  <text x="60" y="340" font-size="18" fill="#ffffff" opacity=".85" font-family="ui-sans-serif, system-ui, sans-serif">Ultimate Sports</text>
</svg>`
}

function svgHero (fit) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600">
  <defs>
    <linearGradient id="h" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${fit.primary}" stop-opacity=".96"/>
      <stop offset="50%" stop-color="${fit.accent}" stop-opacity=".94"/>
      <stop offset="100%" stop-color="${fit.secondary}" stop-opacity=".90"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="600" fill="url(#h)"/>
  <circle cx="1000" cy="160" r="260" fill="#ffffff" opacity=".07"/>
  <circle cx="180" cy="480" r="200" fill="#ffffff" opacity=".05"/>
  <text x="70" y="320" font-size="220" font-family="Arial, sans-serif">${fit.icon}</text>
  <text x="70" y="470" font-size="64" font-weight="900" fill="#ffffff" font-family="ui-rounded, system-ui, sans-serif" letter-spacing="-0.02em">${escapeXml(fit.title)}</text>
  <text x="70" y="525" font-size="24" fill="#ffffff" opacity=".85" font-family="ui-sans-serif, system-ui, sans-serif">Bracket pools · Watch parties · P2P games</text>
</svg>`
}

function escapeXml (text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

fs.mkdirSync(COVER_DIR, { recursive: true })
fs.mkdirSync(HERO_DIR, { recursive: true })

for (const fit of fits) {
  fs.writeFileSync(path.join(COVER_DIR, `${fit.id}.svg`), svgCover(fit))
  fs.writeFileSync(path.join(HERO_DIR, `${fit.id}.svg`), svgHero(fit))
}

console.log(`Wrote ${fits.length} cover and hero SVGs`)
