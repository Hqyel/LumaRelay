# NewEmby Player Bridge

`NewEmby.PlayerBridge` is the Windows companion process for local-player
integration. M2 begins with a .NET 8 executable and an isolated player-adapter
boundary; the loopback service, pairing, protocol registration and PotPlayer
implementation are introduced by later progress items.

## Projects

- `src/NewEmby.PlayerBridge`: executable application.
- `tests/NewEmby.PlayerBridge.Tests`: adapter-boundary unit tests.
- `NewEmby.PlayerBridge.sln`: solution used by local and CI quality gates.

## Commands

Run these commands from the repository root with .NET SDK 8.0.422 installed:

```text
pnpm --filter @newemby/player-bridge build
pnpm --filter @newemby/player-bridge test
pnpm --filter @newemby/player-bridge lint
pnpm bridge:publish
```

The publish command targets `win-x64` and produces a self-contained single-file
executable under `artifacts/win-x64`. End users do not need a separately
installed .NET Runtime.

The HTTP host always binds directly to `127.0.0.1` and, when available, `::1`.
It never honors wildcard URL bindings. The default port is `58080`; override it
with `NEWEMBY_BRIDGE_PORT` or `--bridge-port` using a value from 1024 to 65535.

`GET /v1/status` returns the Bridge identity and version, API compatibility
range, target platform, pairing state and discovered-player summary. Pass the
optional integer query `apiVersion` to evaluate client compatibility. Until
pairing and player discovery are implemented, `isPaired` is false and `players`
is empty.
