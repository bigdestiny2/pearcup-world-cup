# Going Live — real sports data + real money

Ultimate Sports runs on **demo credits and simulated/fixture data by default**. Real
money and real live data are gated behind explicit configuration + compliance so an
unconfigured build can never move funds or invent results. This doc lists exactly what
must be supplied, and the existing commands that verify each gate.

Nothing here is wired to a live account today — it is **blocked on credentials**. Once
the keys below exist in the runtime environment, the seams described here light up.

## 1. Live sports data (per provider)

The sports-data engines (`src/sports-data-*.js`) route each sport to a provider. Supply
the provider API keys as environment variables; missing keys keep that sport on
standup fixtures.

| Provider | Env var | Covers |
|----------|---------|--------|
| Sportradar | `SPORTRADAR_API_KEY` | soccer, basketball, mainstream |
| SportsDataIO (global) | `SPORTSDATAIO_GLOBAL_API_KEY` | US pro sports |
| SportsDataIO (MMA) | `SPORTSDATAIO_MMA_API_KEY` | MMA / boxing fight cards |
| PandaScore | `PANDASCORE_API_KEY` | esports |
| The Odds API | `ODDS_API_KEY` | odds / upset seeding |
| Stats Perform | `STATSPERFORM_API_KEY` | specialty / licensing |
| Football-Data.org | `FOOTBALL_DATA_KEY` | the shell's live scoreboard relay |

Verify:

```sh
npm run smoke:sports-data           # standup fixtures (always passes)
npm run smoke:sports-data:live      # --fail-on-missing: fails until keys are set
```

See `docs/sports-data-provider-plan.md` and `docs/sports-data-aggregator-plan.md` for
the routing model. Provider credentials are the P0 blocker in the grind backlog.

## 2. Real-money settlement (Tether WDK + QVAC)

Real payouts require the WDK wallet stack, a QVAC referee, and every compliance flag
true. All are read from the runtime environment (`app/runtime-settings.js`).

**Tether WDK wallet**
- `PEARCUP_WDK_ENABLED=1`
- `PEARCUP_WDK_SEED=<seed>` — kept local, redacted from all logs/diagnostics
- `PEARCUP_WDK_DEFAULT_PAYOUT_ADDRESS` (or a payout-recipient map)
- `PEARCUP_WDK_ASSETS`, `PEARCUP_EVM_CHAIN_ID`, `PEARCUP_EVM_PROVIDER`, `PEARCUP_BTC_NETWORK`
- payouts default to **quote-only**; broadcasting requires `PEARCUP_WDK_BROADCAST_PAYOUTS=1`

**QVAC referee**
- `PEARCUP_QVAC_ENABLED=1`, `PEARCUP_QVAC_MODEL_SRC` / `PEARCUP_QVAC_MODEL_ID`

**Compliance (all required for real money)**
- `PEARCUP_REAL_MONEY_ENABLED=1`
- `PEARCUP_KYC_VERIFIED=1`
- `PEARCUP_JURISDICTION_ALLOWED=1`
- `PEARCUP_RESPONSIBLE_PLAY_ACCEPTED=1`

With any of these missing, `settlement-service` refuses WDK entry/escrow/payout
commands and the app stays in demo mode. The lobby's Settings → Wallet mode → "Real
money" surfaces this requirement list to the user.

Verify:

```sh
npm run config:live:print   # show the resolved runtime config (secrets redacted)
npm run doctor:live         # readiness report: which SDKs/flags are missing
npm run audit:launch        # refuses launch without QVAC + WDK + payout route evidence
npm run preflight:trusted-path
```

## 3. Turn-on order

1. Set sports-data keys → `npm run smoke:sports-data:live` passes.
2. Configure WDK + QVAC + compliance env → `npm run doctor:live` reports ready.
3. `npm run audit:launch` passes (payout route + attestation evidence present).
4. Only then does the lobby's real-money toggle unlock; until then it stays demo.

Real-money launch also requires legal review — do not enable `PEARCUP_REAL_MONEY_ENABLED`
in production without it.
