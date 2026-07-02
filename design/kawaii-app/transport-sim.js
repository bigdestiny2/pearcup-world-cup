(function attachPearCupTransportSim (root) {
  const core = root.PearCupCore || (typeof require !== 'undefined' ? require('./core.js') : null)
  const workerSim = root.PearCupWorkerSim || (typeof require !== 'undefined' ? require('./worker-sim.js') : null)
  if (!core) throw new Error('PearCupCore is required before PearCupTransportSim')
  if (!workerSim) throw new Error('PearCupWorkerSim is required before PearCupTransportSim')

  function gameTopic (gameId) {
    return `pearcup:v1:game:${gameId}`
  }

  function duplicateEveryOther (events) {
    const delivered = []
    events.forEach((event, index) => {
      delivered.push(event)
      if (index % 2 === 0) delivered.push(event)
    })
    return delivered
  }

  function outOfOrder (events) {
    return [...events].sort((a, b) => b.eventId.localeCompare(a.eventId))
  }

  function createTopicBus ({ topic }) {
    const peers = new Map()
    const deliveries = []

    function workerEvents (worker) {
      return typeof worker.events === 'function' ? worker.events() : []
    }

    function workerView (worker) {
      return typeof worker.view === 'function' ? worker.view() : {}
    }

    async function refreshWorker (worker) {
      if (worker && typeof worker.refresh === 'function') await worker.refresh()
      return {
        view: workerView(worker),
        events: workerEvents(worker)
      }
    }

    function joinPeer (peerId, worker = workerSim.createWorkerSim()) {
      peers.set(peerId, { peerId, worker })
      return peers.get(peerId)
    }

    function getPeer (peerId) {
      const peer = peers.get(peerId)
      if (!peer) throw new Error(`Unknown peer: ${peerId}`)
      return peer
    }

    function publishFrom (peerId, options = {}) {
      const source = getPeer(peerId)
      const sourceEvents = workerEvents(source.worker)
      const deliveredEvents = options.outOfOrder ? outOfOrder(sourceEvents) : sourceEvents
      const payload = options.duplicates ? duplicateEveryOther(deliveredEvents) : deliveredEvents
      const report = []

      for (const peer of peers.values()) {
        if (peer.peerId === peerId) continue
        const beforeRoot = workerView(peer.worker).eventRoot
        const merged = peer.worker.mergeEvents(payload)
        const afterRoot = workerView(peer.worker).eventRoot
        const delivery = {
          topic,
          from: peerId,
          to: peer.peerId,
          offered: payload.length,
          merged,
          beforeRoot,
          afterRoot
        }
        deliveries.push(delivery)
        report.push(delivery)
      }

      return report
    }

    async function publishFromAsync (peerId, options = {}) {
      const source = getPeer(peerId)
      await refreshWorker(source.worker)
      const sourceEvents = workerEvents(source.worker)
      const deliveredEvents = options.outOfOrder ? outOfOrder(sourceEvents) : sourceEvents
      const payload = options.duplicates ? duplicateEveryOther(deliveredEvents) : deliveredEvents
      const report = []

      for (const peer of peers.values()) {
        if (peer.peerId === peerId) continue
        await refreshWorker(peer.worker)
        const beforeRoot = workerView(peer.worker).eventRoot
        const merged = typeof peer.worker.mergeEventsAsync === 'function'
          ? await peer.worker.mergeEventsAsync(payload)
          : peer.worker.mergeEvents(payload)
        await refreshWorker(peer.worker)
        const afterRoot = workerView(peer.worker).eventRoot
        const delivery = {
          topic,
          from: peerId,
          to: peer.peerId,
          offered: payload.length,
          merged,
          beforeRoot,
          afterRoot
        }
        deliveries.push(delivery)
        report.push(delivery)
      }

      return report
    }

    function syncAll (options = {}) {
      const reports = []
      for (const peerId of peers.keys()) reports.push(...publishFrom(peerId, options))
      return {
        topic,
        reports,
        roots: roots(),
        converged: converged()
      }
    }

    async function syncAllAsync (options = {}) {
      const reports = []
      for (const peerId of peers.keys()) reports.push(...await publishFromAsync(peerId, options))
      return {
        topic,
        reports,
        roots: await rootsAsync(),
        converged: await convergedAsync()
      }
    }

    function roots () {
      return Array.from(peers.values()).map(peer => ({
        peerId: peer.peerId,
        root: workerView(peer.worker).eventRoot,
        events: workerEvents(peer.worker).length
      }))
    }

    async function rootsAsync () {
      const rows = []
      for (const peer of peers.values()) {
        await refreshWorker(peer.worker)
        rows.push({
          peerId: peer.peerId,
          root: workerView(peer.worker).eventRoot,
          events: workerEvents(peer.worker).length
        })
      }
      return rows
    }

    function converged () {
      const currentRoots = roots()
      return currentRoots.length > 0 && currentRoots.every(peer => peer.root === currentRoots[0].root)
    }

    async function convergedAsync () {
      const currentRoots = await rootsAsync()
      return currentRoots.length > 0 && currentRoots.every(peer => peer.root === currentRoots[0].root)
    }

    return {
      topic,
      joinPeer,
      publishFrom,
      publishFromAsync,
      syncAll,
      syncAllAsync,
      roots,
      rootsAsync,
      converged,
      convergedAsync,
      deliveries: () => [...deliveries]
    }
  }

  const api = { createTopicBus, gameTopic, duplicateEveryOther, outOfOrder }

  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.PearCupTransportSim = api
  if (root.document && root.document.documentElement) {
    root.document.documentElement.dataset.pearcupTransportSim = 'topic-sync-v1'
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
