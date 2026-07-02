const assert = require('node:assert/strict')
const test = require('node:test')
require('./core.js')
require('./adapters.js')
require('./qvac-referee.js')
require('./tether-wdk-bridge.js')
require('./sdk-runtime.js')
require('./runtime-config.js')
require('./runtime-settings.js')
require('./worker-sim.js')
require('./worker-runtime.js')
require('./settlement-receipts.js')
require('./settlement-service.js')
const bridgeProtocol = require('./worker-bridge-protocol.js')

test('Pear worker bridge protocol dispatches non-prize commands and returns snapshots', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol()
  const response = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-local-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'game:submitCommitment',
        actorId: 'user-a',
        payload: {
          gameId: 'pc-bridge',
          roundId: 'round-1',
          playerId: 'user-a',
          commitment: 'commitment-a'
        }
      }
    }
  })

  assert.equal(response.ok, true)
  assert.equal(response.requestId, 'req-local-1')
  assert.equal(response.result.type, 'GameCommitmentSubmitted')
  assert.equal(response.view.typeCounts.GameCommitmentSubmitted, 1)
  assert.equal(response.eventsIncluded, false)
  assert.equal(response.events.length, 0)

  const snapshot = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-local-2',
    action: 'snapshot',
    payload: {
      includeEvents: true
    }
  })

  assert.equal(snapshot.ok, true)
  assert.equal(snapshot.eventsIncluded, true)
  assert.equal(snapshot.events.length, 1)
  await bridge.close()
})

test('Pear worker bridge protocol blocks prize commands while live gate is locked', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol()
  const response = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-locked-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'wdk:createEntryIntent',
        actorId: 'user-a',
        payload: {
          poolId: 'pool-locked',
          entryId: 'entry-locked',
          userId: 'user-a',
          username: 'a',
          amount: 25,
          asset: 'USDT'
        }
      }
    }
  })

  assert.equal(response.ok, false)
  assert.equal(response.code, 'PEARCUP_SETTLEMENT_LOCKED')
  assert.equal(response.status.settlementGate.status, 'demo-locked')
  assert.equal(response.events.length, 0)
  await bridge.close()
})

test('Pear worker bridge protocol blocks payout route declarations while live gate is locked', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol()
  const response = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-locked-recipient-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'payout:declareRecipient',
        actorId: 'user-a',
        payload: {
          poolId: 'pool-locked',
          userId: 'user-a',
          username: 'a',
          asset: 'USDT',
          recipient: '0xlockedbridgerecipient000000000000000000000'
        }
      }
    }
  })

  assert.equal(response.ok, false)
  assert.equal(response.code, 'PEARCUP_SETTLEMENT_LOCKED')
  assert.equal(response.action, 'dispatch')
  assert.equal(response.status.settlementGate.status, 'demo-locked')
  assert.equal(response.events.length, 0)
  await bridge.close()
})

test('Pear worker bridge protocol blocks direct QVAC referee dispatch while live gate is locked', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol()
  const roundResponse = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-locked-qvac-round-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'qvac:refereeAttest',
        actorId: 'qvac-ref',
        payload: {
          gameId: 'pc-locked-qvac',
          roundId: 'pc-1'
        }
      }
    }
  })
  const poolResponse = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-locked-qvac-pool-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'qvac:attestPoolSettlement',
        actorId: 'qvac-ref',
        payload: {
          poolId: 'pool-locked-qvac'
        }
      }
    }
  })

  assert.equal(roundResponse.ok, false)
  assert.equal(roundResponse.code, 'PEARCUP_SETTLEMENT_LOCKED')
  assert.equal(roundResponse.status.settlementGate.status, 'demo-locked')
  assert.equal(roundResponse.events.length, 0)
  assert.equal(poolResponse.ok, false)
  assert.equal(poolResponse.code, 'PEARCUP_SETTLEMENT_LOCKED')
  assert.equal(poolResponse.status.settlementGate.status, 'demo-locked')
  assert.equal(poolResponse.events.length, 0)
  await bridge.close()
})

test('Pear worker bridge protocol blocks direct settlement receipt recording while live gate is locked', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol()
  const response = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-locked-receipt-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'settlement:recordReceipt',
        actorId: 'settlement-auditor',
        payload: {
          receipt: {
            receiptId: 'receipt-locked',
            receiptHash: 'receipt-hash-locked',
            eventRoot: 'root-locked',
            events: {
              settlement: {
                eventId: 'evt-locked'
              }
            }
          }
        }
      }
    }
  })

  assert.equal(response.ok, false)
  assert.equal(response.code, 'PEARCUP_SETTLEMENT_LOCKED')
  assert.equal(response.action, 'dispatch')
  assert.equal(response.status.settlementGate.status, 'demo-locked')
  assert.equal(response.events.length, 0)
  await bridge.close()
})

test('Pear worker bridge protocol blocks direct raw settlement evidence while live gate is locked', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol()
  const commands = [
    {
      type: 'game:resolveRound',
      actorId: 'system',
      payload: {
        gameId: 'pc-locked-evidence',
        roundIndex: 0,
        shooter: { id: 'user-shooter' },
        keeper: { id: 'user-keeper' }
      }
    },
    {
      type: 'game:submitRoundStateHash',
      actorId: 'user-shooter',
      payload: {
        gameId: 'pc-locked-evidence',
        roundId: 'pc-1',
        playerId: 'user-shooter',
        stateHash: '0xlockedstatehash'
      }
    },
    {
      type: 'game:recordForfeit',
      actorId: 'settlement-worker',
      payload: {
        gameId: 'pc-locked-evidence',
        roundId: 'pc-1',
        shooter: { id: 'user-shooter' },
        keeper: { id: 'user-keeper' },
        forfeitingPlayerId: 'user-keeper',
        winnerUserId: 'user-shooter',
        reason: 'reveal-timeout'
      }
    },
    {
      type: 'results:recordOfficialSnapshot',
      actorId: 'official-results-feed',
      payload: {
        poolId: 'pool-locked-evidence',
        officialResults: { champion: 'Brazil' }
      }
    },
    {
      type: 'pool:resolveSettlement',
      actorId: 'bracket-rules',
      payload: {
        poolId: 'pool-locked-evidence',
        winnerUserIds: ['user-a']
      }
    }
  ]

  for (const [index, command] of commands.entries()) {
    const response = await bridge.request({
      protocol: bridgeProtocol.protocolVersion,
      requestId: `req-locked-evidence-${index + 1}`,
      action: 'dispatch',
      payload: { command }
    })

    assert.equal(response.ok, false)
    assert.equal(response.code, 'PEARCUP_SETTLEMENT_LOCKED')
    assert.equal(response.action, 'dispatch')
    assert.equal(response.status.settlementGate.status, 'demo-locked')
    assert.equal(response.events.length, 0)
  }

  await bridge.close()
})

test('Pear worker bridge protocol can explicitly run demo prize dispatch when allowed', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol({ requireLive: false })
  const response = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-demo-1',
    action: 'dispatch',
    payload: {
      command: {
        type: 'wdk:createEntryIntent',
        actorId: 'user-a',
        payload: {
          poolId: 'pool-demo',
          entryId: 'entry-demo',
          userId: 'user-a',
          username: 'a',
          amount: 25,
          asset: 'USDT'
        }
      }
    }
  })

  assert.equal(response.ok, true)
  assert.equal(response.result.type, 'TetherWdkEntryIntentCreated')
  assert.equal(response.status.guardMode, 'demo-allowed')
  assert.equal(response.view.typeCounts.TetherWdkEntryIntentCreated, 1)
  await bridge.close()
})

test('Pear worker bridge protocol allows explicit demo trusted settlement helpers', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol()
  const response = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-demo-trusted-game-1',
    action: 'settleGameRoundWithReceipt',
    payload: {
      opts: {
        actorId: 'settlement-worker',
        requireLive: false
      },
      payload: {
        gameId: 'pc-bridge-demo-trusted',
        roundIndex: 0,
        roundId: 'pc-1',
        shooter: { id: 'user-shooter', username: 'shooter' },
        keeper: { id: 'user-keeper', username: 'keeper' },
        escrowId: 'escrow-missing'
      }
    }
  })

  assert.equal(response.ok, true)
  assert.equal(response.status.guardMode, 'demo-allowed')
  assert.equal(response.result.summary.roundEvent.type, 'GameSessionDisputed')
  assert.equal(response.result.receiptHeld, true)
  assert.equal(response.code, undefined)
  await bridge.close()
})

test('Pear worker bridge protocol redacts seed phrases and payout recipients from responses', async () => {
  const rawSeed = 'valid bridge protocol seed phrase'
  const rawRecipient = '0xbridgeprotocolrecipient000000000000000000000'
  const harness = {
    async dispatchAsync () {
      return {
        type: 'TetherWdkPoolPayoutPrepared',
        payload: {
          recipient: rawRecipient,
          payoutRecipients: { winner: rawRecipient },
          processorPayout: {
            transfers: [
              {
                recipient: rawRecipient,
                recipientHash: 'recipient-hash-ok'
              }
            ]
          },
          processorRelease: {
            transfers: [
              {
                recipient: rawRecipient,
                recipientHash: 'release-recipient-hash-ok'
              }
            ]
          }
        }
      }
    },
    worker: {
      view () {
        return {
          eventRoot: 'root-redacted',
          lastPayout: {
            recipient: rawRecipient,
            payoutRecipients: { winner: rawRecipient },
            seedPhrase: rawSeed,
            processorRelease: {
              transfers: [
                {
                  recipient: rawRecipient,
                  recipientHash: 'view-release-recipient-hash-ok'
                }
              ]
            }
          }
        }
      },
      events () {
        return [
          {
            type: 'TetherWdkPoolPayoutPrepared',
            payload: {
              recipient: rawRecipient,
              payoutRecipients: { winner: rawRecipient },
              processorRelease: {
                transfers: [
                  {
                    recipient: rawRecipient,
                    recipientHash: 'event-release-recipient-hash-ok'
                  }
                ]
              }
            }
          }
        ]
      },
      adapterMode () {
        return { qvac: 'sdk', tetherWdk: 'sdk' }
      },
      mergeEvents () {
        return 0
      }
    }
  }
  const service = {
    requireLive: false,
    harness,
    status () {
      return {
        guardMode: 'demo-allowed',
        settings: {
          sdkPackages: {
            tetherWdk: {
              seedPhrase: '[redacted]',
              defaultPayoutAddress: '[redacted]'
            }
          }
        }
      }
    }
  }
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol({
    service,
    settings: {
      sdkPackages: {
        tetherWdk: {
          seedPhrase: rawSeed
        }
      }
    }
  })
  const response = await bridge.request({
    protocol: bridgeProtocol.protocolVersion,
    requestId: 'req-redact-1',
    action: 'dispatch',
    payload: {
      includeEvents: true,
      command: {
        type: 'wdk:createPoolPayout',
        actorId: 'tether-wdk',
        payload: {}
      }
    }
  })
  const json = JSON.stringify(response)

  assert.equal(response.ok, true)
  assert.equal(response.eventsIncluded, true)
  assert.equal(json.includes(rawSeed), false)
  assert.equal(json.includes(rawRecipient), false)
  assert.equal(json.includes('recipient-hash-ok'), true)
  assert.equal(response.result.payload.recipient, '[redacted]')
  assert.equal(response.result.payload.payoutRecipients.winner, '[redacted]')
  assert.equal(response.result.payload.processorPayout.transfers[0].recipient, '[redacted]')
  assert.equal(response.result.payload.processorRelease.transfers[0].recipient, '[redacted]')
  assert.equal(response.view.lastPayout.processorRelease.transfers[0].recipient, '[redacted]')
  assert.equal(response.events[0].payload.processorRelease.transfers[0].recipient, '[redacted]')
})

test('Pear worker bridge protocol rejects unsupported envelopes without throwing to caller', async () => {
  const bridge = bridgeProtocol.createPearWorkerBridgeProtocol()
  const response = await bridge.request({
    protocol: 'wrong-protocol',
    requestId: 'req-bad-1',
    action: 'dispatch',
    payload: {}
  })

  assert.equal(response.ok, false)
  assert.match(response.error, /Unsupported PearCup worker protocol/)
  await bridge.close()
})
