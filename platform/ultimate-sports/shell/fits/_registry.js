// Ultimate Sports fit registry. Each fit file calls registerFit(id, config).
(function (root) {
  'use strict'
  root.ULTIMATE_FIT_REGISTRY = root.ULTIMATE_FIT_REGISTRY || {}
  root.registerFit = function (id, config) {
    root.ULTIMATE_FIT_REGISTRY[id] = config
  }
})(window)
