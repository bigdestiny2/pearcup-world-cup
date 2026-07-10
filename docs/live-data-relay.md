# Kawaii Cup live-data relay

The released Pear app is keyless. It fetches the public snapshots below from this
HTTPS relay; only the relay process receives `FOOTBALL_DATA_KEY` from its hosting
platform's secret manager.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/live-match.json` | Football-Data World Cup fixture and active-match snapshot |
| `GET /v1/polymarket-odds.json` | Public, informational Polymarket fixture registry |
| `GET /v1/polymarket-odds.json?matchId=<id>` | One fixture's public Polymarket implied odds |
| `GET /healthz` | Readiness/staleness health check |

The endpoints publish no credentials, accept no user data, and are safe to cache.
The relay retains its last-known-good snapshot when Football-Data is temporarily
unavailable. `/healthz` changes to `503` only when that snapshot is older than
`MAX_STALE_SECONDS`.

Production endpoint:

- `https://pearcup-live-data.throbbing-limit-1abb.workers.dev/healthz`
- `https://pearcup-live-data.throbbing-limit-1abb.workers.dev/v1/live-match.json`
- `https://pearcup-live-data.throbbing-limit-1abb.workers.dev/v1/polymarket-odds.json`

The odds endpoint is a `pearcup-polymarket-v2` registry keyed by the official
Football-Data fixture ID. It refreshes the live fixture plus the next confirmed
fixtures (six by default), keeps the last successful price per fixture on a
temporary Polymarket failure, and preserves that price's original `fetchedAt`.
Clients therefore label it **Stale** instead of silently presenting it as fresh.

## Deploy

Build the small standalone worker:

```sh
docker build -f Dockerfile.live-data-relay -t pearcup-live-data-relay .
docker run --rm -p 8787:8787 \
  -e FOOTBALL_DATA_KEY='injected-by-your-host-secret-manager' \
  -e PUBLIC_CORS_ORIGINS='*' \
  -v pearcup-live-data:/data \
  pearcup-live-data-relay
```

Terminate TLS at the deployment edge and expose the JSON paths over HTTPS. Set the
following deployment variables, not values in the app repo:

| Variable | Default | Notes |
| --- | --- | --- |
| `FOOTBALL_DATA_KEY` | required | Deployment secret; never ships to Pear. |
| `REFRESH_SECONDS` | `60` | Clamped to 15–900 seconds. |
| `REQUEST_TIMEOUT_SECONDS` | `10` | Per Football-Data request timeout, clamped to 2–30 seconds. |
| `MAX_STALE_SECONDS` | `300` | Health threshold for the last successful snapshot. |
| `MATCH_ID` | empty | Optional explicit Football-Data match id. |
| `POLYMARKET_ENABLED` | `true` | Set `false` to omit public odds updates. |
| `PUBLIC_CORS_ORIGINS` | `*` | Data is public and credential-free; restrict if your client origin is stable. |
| `CACHE_DIR` | unset | Use persistent `/data` in the supplied container. |

For a local operator run only, KeyVault can inject the value into the worker:

```sh
keyvault exec --scope sports/football-data sh -c 'FOOTBALL_DATA_KEY="$API_KEY" npm run worker:live-data'
```

This is not the production refresh model: a deployed worker should use its host's
secret manager and run continuously. After deployment, put the public HTTPS JSON
URL in the Kawaii runtime setting `PEARCUP_LIVE_DATA_RELAY_URL`; that URL is safe
to expose to the renderer.

## Cloudflare Worker deployment

`workers/pearcup-live-data.mjs` is the managed production option: it runs every
minute, persists snapshots in Cloudflare KV, and never returns the Football-Data
credential. Copy `workers/wrangler.live-data.toml.example`, replace the KV namespace
placeholder, deploy it with Wrangler, then set `FOOTBALL_DATA_KEY` as a Worker
secret. The public result is a `https://<worker>.<account>.workers.dev/v1/live-match.json`
URL suitable for the renderer; the secret is never included in Pear or Hyperdrive.
