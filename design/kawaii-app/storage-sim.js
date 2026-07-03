(function attachPearCupStorageSim (root) {
  const canRequireLocal = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined'
  const core = root.PearCupCore || (canRequireLocal ? require('./core.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupStorageSim')

  function eventRoot (events) {
    return core.deterministicHash(events
      .map(event => ({
        eventId: event.eventId,
        signature: event.signature,
        type: event.type
      }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)))
  }

  function typeCounts (events) {
    return events.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1
      return counts
    }, {})
  }

  function namespaceKey ({ rootId = 'pearcup-local', namespace }) {
    if (!namespace) throw new Error('namespace is required')
    return `${rootId}:${namespace}`
  }

  function gameNamespace (gameId) {
    if (!gameId) throw new Error('gameId is required')
    return `games/${gameId}/events`
  }

  function normalizeEvents (events) {
    if (!Array.isArray(events)) return []
    return events.filter(event => event && event.eventId && event.type)
  }

  function dedupeEvents (events) {
    const seen = new Set()
    const deduped = []
    for (const event of normalizeEvents(events)) {
      if (seen.has(event.eventId)) continue
      seen.add(event.eventId)
      deduped.push(event)
    }
    return deduped
  }

  function createMemoryBackend (initial = {}) {
    const buckets = new Map(Object.entries(initial).map(([key, value]) => [key, dedupeEvents(value)]))
    return {
      kind: 'memory',
      read (key) {
        return [...(buckets.get(key) || [])]
      },
      write (key, events) {
        buckets.set(key, dedupeEvents(events))
      },
      keys () {
        return [...buckets.keys()].sort()
      },
      clear (key) {
        if (key) buckets.delete(key)
        else buckets.clear()
      }
    }
  }

  function createLocalStorageBackend ({ localStorage = root.localStorage, prefix = 'pearcup-storage' } = {}) {
    if (!localStorage) throw new Error('localStorage is required for createLocalStorageBackend')

    function storageKey (key) {
      return `${prefix}:${key}`
    }

    return {
      kind: 'localStorage',
      read (key) {
        try {
          return dedupeEvents(JSON.parse(localStorage.getItem(storageKey(key)) || '[]'))
        } catch {
          return []
        }
      },
      write (key, events) {
        localStorage.setItem(storageKey(key), JSON.stringify(dedupeEvents(events)))
      },
      keys () {
        const keys = []
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index)
          if (key && key.startsWith(`${prefix}:`)) keys.push(key.slice(prefix.length + 1))
        }
        return keys.sort()
      },
      clear (key) {
        if (key) {
          localStorage.removeItem(storageKey(key))
          return
        }
        for (const bucket of this.keys()) localStorage.removeItem(storageKey(bucket))
      }
    }
  }

  function createEventStore ({
    backend = createMemoryBackend(),
    rootId = 'pearcup-local',
    namespace = 'events'
  } = {}) {
    const key = namespaceKey({ rootId, namespace })

    function readEvents () {
      return dedupeEvents(backend.read(key))
    }

    function writeEvents (events) {
      backend.write(key, dedupeEvents(events))
    }

    function appendEvents (events) {
      const current = readEvents()
      const existingIds = new Set(current.map(event => event.eventId))
      const incoming = normalizeEvents(events)
      const merged = [...current]
      let appended = 0

      for (const event of incoming) {
        if (existingIds.has(event.eventId)) continue
        existingIds.add(event.eventId)
        merged.push(event)
        appended++
      }

      if (appended > 0) writeEvents(merged)
      return appended
    }

    function clear () {
      backend.clear(key)
    }

    function snapshot () {
      const events = readEvents()
      return {
        rootId,
        namespace,
        key,
        backend: backend.kind || 'custom',
        events: events.length,
        eventRoot: eventRoot(events),
        typeCounts: typeCounts(events)
      }
    }

    return {
      key,
      rootId,
      namespace,
      readEvents,
      writeEvents,
      appendEvents,
      clear,
      snapshot
    }
  }

  const api = {
    createEventStore,
    createLocalStorageBackend,
    createMemoryBackend,
    dedupeEvents,
    eventRoot,
    gameNamespace,
    namespaceKey,
    typeCounts
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupStorageSim = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupStorageSim = 'storage-sim-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
