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

## Portable use

The current release is portable and does not include an installer or
uninstaller. Copy `NewEmby.PlayerBridge.exe` to a stable user-selected directory
and run it directly. Register the browser protocol once from that final
location:

```text
NewEmby.PlayerBridge.exe --register-protocol
```

Before moving or deleting the executable, stop the running Bridge and remove the
old protocol registration. Register it again after moving it:

```text
NewEmby.PlayerBridge.exe --shutdown
NewEmby.PlayerBridge.exe --unregister-protocol
```

The HTTP host always binds directly to `127.0.0.1` and, when available, `::1`.
It never honors wildcard URL bindings. The default port is `58080`; override it
with `NEWEMBY_BRIDGE_PORT` or `--bridge-port` using a value from 1024 to 65535.

`GET /v1/status` returns the Bridge identity and version, API compatibility
range, target platform, pairing state and discovered-player summary. Pass the
optional integer query `apiVersion` to evaluate client compatibility. Until
player discovery is implemented, `players` is empty. `isPaired` reflects whether
a valid device credential is present in the current Windows user's Credential
Manager.

The Web pairing flow opens a short-lived `newemby://pair` URI. For local
diagnostics, the equivalent command is:

```text
NewEmby.PlayerBridge.exe --pair https://newemby.example.com PAIRING_CODE
```

The Gateway must use HTTPS; plain HTTP is accepted only for a loopback Gateway.
The 60-second pairing code is exchanged once and is never persisted by the
Bridge. The resulting device credential is stored as a Generic Credential for
the current Windows user. Pairing failures report only the HTTP status and never
print the pairing code or device credential.

Browser requests carrying an `Origin` are accepted only when the exact origin
was supplied by the Gateway during pairing. Local command-line diagnostics may
read `/v1/status` without an Origin. Browser state changes require both an
allowed Origin and a fresh 22–128 character Base64URL value in
`X-NewEmby-Nonce`; a nonce cannot be reused within five minutes.

`OPTIONS /v1/*` returns CORS and Private Network Access headers only for an
allowed origin. `POST /v1/pairing/verify` is the non-destructive state-change
probe. Bridge-to-Gateway requests use the `NewEmbyDevice` authorization scheme
and a new nonce; the first authenticated endpoint is
`POST /api/v1/bridge/devices/:deviceId/heartbeat`.

The portable executable registers the per-user `newemby://` protocol when run
with `--register-protocol`. It writes only below
`HKCU\Software\Classes\newemby`, quotes both the executable and `%1`, and needs
no administrator access. Use `--unregister-protocol` before removing or moving
the portable executable.

The Windows build runs without a console window and remains available through a
notification-area icon. Its compact menu shows the Bridge version and an exit
action. Only one Bridge instance can run per user. For automated maintenance,
`NewEmby.PlayerBridge.exe --shutdown` signals the running instance to stop its
HTTP host and exit cleanly.
