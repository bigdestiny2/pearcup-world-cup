# PearCup browser delivery and portable identity

The public browser entry point is `https://pearcup-kawaii.pages.dev/play/`.
The Pages root remains the marketing site. The build command combines them only
at deploy time; neither source tree borrows code or assets from the other.

## Identity boundary

The browser page is the WebAuthn relying-party origin:

- RP ID: `pearcup-kawaii.pages.dev`
- expected origin: `https://pearcup-kawaii.pages.dev`
- account id: a random opaque 128-bit value, also used as the stable PearCup
  player id
- passkeys and public device keys only; no mnemonic, Pear root identity,
  private wallet key, payment authorization, or live-money balance is stored
  in Cloudflare D1.

Cloudflare preview deployment URLs intentionally do not expose passkey actions:
they are not the registered relying-party origin. Test portable identity only
at the canonical Pages hostname.

Each browser/Pear install has a distinct non-extractable Ed25519 device key.
To link a Pear Runtime or PearBrowser install, the host creates a ten-minute
pairing code, opens `/play/?pair=CODE`, and a signed-in passkey account
explicitly approves the device name and fingerprint. The installing host must
then sign its claim using its local device private key. A copied code alone is
not sufficient to take over an account.

Device-session tokens can be retained alongside the non-extractable device
key, but are proof-of-possession bound: every device-authorized request signs
its method, path, timestamp, and body digest. A copied token without the local
private key is rejected. A user can always restore the same account in a normal
browser with its passkey.

## Cloudflare pieces

- Pages (`pearcup-kawaii`) serves the public root and `/play/` artifact.
- Worker (`pearcup-kawaii-identity`) provides passkey ceremonies, pairing,
  account profile, device registry, and server-side **demo** balance.
- D1 (`pearcup-kawaii-identity`) holds only the account-side public metadata.
- The Worker may have a `workers.dev` API hostname. That hostname is never the
  WebAuthn RP origin; the Pages hostname remains the sole passkey origin.

## HiveRelay boundary

Cloudflare does not replace HiveRelay. The browser/Pear shared transport uses a
dedicated, persistent HiveRelay OutboxLog node behind the narrow HTTPS Worker
gateway at `https://pearcup-kawaii-relay.throbbing-limit-1abb.workers.dev`.
The gateway exposes only token, status, join, send, leave, and SSE routes; it
is not a general proxy. The node admits the `pearcup` namespace and its relay
port accepts traffic only from Cloudflare edge ranges.

Verify the exact public endpoint before enabling it in a release:

```bash
PEARCUP_HIVERELAY_URL=https://pearcup-kawaii-relay.throbbing-limit-1abb.workers.dev \
  npm run test:hiverelay-endpoint
```

The relay transports signed, short-lived application frames. It must never
receive passkey assertions, wallet data, private device keys, operator tokens,
or real-money payment authorization.

## Build and release

1. Apply Worker migrations and deploy the identity Worker.
2. Set `PEARCUP_IDENTITY_API_URL` to the Worker HTTPS origin.
3. Set `PEARCUP_HIVERELAY_URL` to the verified HTTPS gateway, then run
   `npm run build:cloudflare-pages` and `npm run check:cloudflare-pages`.
4. Deploy `cloudflare/pages-dist` to the existing `pearcup-kawaii` Pages
   project.
5. Test the exact Pages URL in a normal browser before enabling the dedicated
   HiveRelay public endpoint.

No Cloudflare deployment in this project may create or modify `ieset.org`.
