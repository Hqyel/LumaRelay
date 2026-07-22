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
optional integer query `apiVersion` to evaluate client compatibility. PotPlayer
discovery checks a currently running process, the current-user and machine App
Paths/vendor registry entries, and bounded standard install locations. A
candidate must resolve to an existing supported PotPlayer executable. Duplicate
paths are collapsed, a running installation is preferred, and x64 is preferred
when no installation is running.

Each discovered-player summary contains the stable adapter ID, display name,
version, architecture and running state. The executable path remains inside the
Bridge and is never returned by the status API. PotPlayer launchers that expose
the placeholder version `0.0.0.0` use the trusted core DLL in the same directory
for the version instead. `players` is empty when PotPlayer is not installed.
`isPaired` reflects whether a valid device credential is present in the current
Windows user's Credential Manager.

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

The Gateway issues a 60-second, device-bound PlayTicket through
`POST /api/v1/bridge/play-tickets`. A paired Bridge redeems it once through
`POST /api/v1/bridge/devices/:deviceId/play-tickets/redeem`, using its device
credential and a fresh nonce. The redemption response contains only the
PlaySession ID and playback selection; it never contains an Emby access token.
The local play endpoint and player launch are added by later M2 tasks.

To revoke the current portable Bridge from both sides, run:

```text
NewEmby.PlayerBridge.exe --unpair
```

The Bridge first calls the authenticated Gateway credential-revocation endpoint.
It removes the Generic Credential only after a successful response, or after a
`401` confirms that the remote credential is already unusable. Other Gateway
failures retain the local credential so the operation can be retried. No
credential or nonce is printed.

The Web device-management flow lists only devices owned by the current Emby
user. It revokes the Gateway device before calling the protected loopback
`DELETE /v1/pairing` endpoint with the paired Origin and a fresh nonce to clear
the local Generic Credential. Calling the loopback endpoint alone does not
revoke the Gateway device.

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
