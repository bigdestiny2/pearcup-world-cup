# QVAC in PearBrowser

PearBrowser and a normal web browser cannot import `@qvac/sdk` directly. The
SDK's supported JavaScript environments are Node, Bare, and Expo; the model
backend uses native llama.cpp addons. PearCup therefore uses QVAC's supported
OpenAI-compatible HTTP server as the browser seam. The server and model remain
local to the user's machine; the browser only sends prompts to loopback.

## Start the local model service

From the repository root, install the QVAC CLI once if it is not already
available, then start the server with CORS enabled:

```sh
npx --package "@qvac/cli" qvac serve openai \
  --config scripts/qvac-browser.config.json \
  --host 127.0.0.1 --port 11435 --cors
```

The app is configured for `http://127.0.0.1:11435/v1` and the
`qvac-kawaii-qwen3-1.7b` alias. The first request may download/load the model;
subsequent trivia, commentary, football analysis, and referee calls reuse the
preloaded local model.

The browser adapter is loopback-only by default, never forwards a QVAC key,
and falls back to the verified deterministic lane if the local service is not
running. Native Pear runtime keeps its in-process QVAC SDK path and does not
use this HTTP bridge.
