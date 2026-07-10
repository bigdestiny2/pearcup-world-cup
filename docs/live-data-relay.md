# Kawaii Cup live-data relay

The released Pear app is keyless. It fetches the public snapshots below from this
HTTPS relay; only the relay process receives `FOOTBALL_DATA_KEY` from its hosting
platform's secret manager.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/live-match.json` | Football-Data World Cup fixture and active-match snapshot |
| `GET /v1/polymarket-odds.json` | Public, informational Polymarket implied odds |
| `GET /healthz` | Readiness/staleness health check |

The endpoints publish no credentials, accept no user data, and are safe to cache.
The relay retains its last-known-good snapshot when Football-Data is temporarily
unavailable. `/healthz` changes to `503` only when that snapshot is older than
`MAX_STALE_SECONDS`.

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
