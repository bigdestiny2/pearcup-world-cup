// Group-plus-knockout override. Runs AFTER generic-fits.js and augments a
// bracket fit with a group stage: chunk its teams into groups of four and add
// templateKind 'group-plus-knockout'. The shell then renders group tables where
// you predict each group's winner and runner-up. Reuses the generic fit's teams
// and theme (no data duplication).
(function (root) {
  'use strict'

  const registry = root.ULTIMATE_FIT_REGISTRY || {}
  const GROUP_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

  function groupsFromTeams (teams) {
    const groups = []
    for (let i = 0; i < teams.length; i += 4) {
      const chunk = teams.slice(i, i + 4)
      if (chunk.length < 2) break
      const name = GROUP_NAMES[i / 4] || String(i / 4 + 1)
      groups.push({ id: 'grp-' + name, name: 'Group ' + name, teams: chunk.map(team => team.id) })
    }
    return groups
  }

  function applyGroupStage (fitId) {
    const base = registry[fitId]
    if (!base || !Array.isArray(base.teams)) return
    root.registerFit(fitId, Object.assign({}, base, {
      templateKind: 'group-plus-knockout',
      groups: groupsFromTeams(base.teams)
    }))
  }

  applyGroupStage('euros-copa-america')
  applyGroupStage('esports-major')
})(window)
