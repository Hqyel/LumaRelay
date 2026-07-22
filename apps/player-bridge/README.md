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

The `smtc` status object reports `capability`, `isMonitoring`, aggregate session
counts and `potPlayerSessionState`. `ready` means the Windows global media
session manager was created and its event subscriptions are active;
`unavailable` means the API could not be opened, while `unsupported` means the
operating system is below the supported API baseline. `notObserved` only means
that no PotPlayer SMTC session currently exists. It does not claim that the
PotPlayer setting is disabled while the player is idle.

The monitor follows session additions and removals and subscribes to media
properties, playback information and timeline changes for every current session.
Individual source application IDs stay inside the Bridge; the status API exposes
counts only. NewEmby targets Windows 10 version 2004 (build 19041) or newer,
above the Windows 10 version 1809 introduction of the global media control API.

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
The browser starts playback with an allowed Origin and fresh nonce through
`POST /v1/playback/start`. The Bridge redeems the ticket once, keeps the
selection only in memory, and launches PotPlayer with protected loopback URLs.
PotPlayer reads `/v1/playback/<play-session-id>/media|subtitle` without a
browser Origin; the Bridge signs a device-bound Gateway request for every stream
and forwards byte ranges. The Gateway restores the encrypted Emby session and
proxies the static stream, so neither the local URL nor the player arguments
contain an Emby access token.

The PotPlayer adapter builds process launches without a command shell and adds
every value through `ProcessStartInfo.ArgumentList`. It always requests `/new`,
adds `/seek=HH:MM:SS.mmm` only for a non-zero resume point, identifies the
session as `/title=NewEmby:<play-session-id>`, and adds `/sub=<loopback-uri>`
only when an external subtitle is selected. The media URI is the final separate
argument.

Both media and subtitle inputs must be literal IPv4 or IPv6 loopback HTTP URLs
on the configured Bridge port with the exact path
`/v1/playback/<play-session-id>/media|subtitle`. User information, query
strings, fragments, other ports and non-loopback hosts are rejected.
Consequently the launcher cannot add `/headers`, an Emby URL or an Emby
AccessToken to the process command line. The protected local endpoints reject
unknown or stopped sessions, missing subtitle selections and browser-origin
stream reads.

After a successful process start, the Bridge tracks the process ID, its launch
time and the PlaySession ID. The GSMTC matcher accepts a session only when the
recorded process is still the same live process, the source application is an
exact supported PotPlayer executable identity, and the media title exactly
matches `NewEmby:<play-session-id>`. A unique PotPlayer session without that
title is never guessed. Duplicate exact candidates remain `ambiguous`; a live
process without a candidate remains `awaiting` for 15 seconds and then becomes
`timedOut`; an exited or reused process becomes `processExited`.

Matching is refreshed on session-list and media-property events and by a
one-second bounded fallback poll. Multiple NewEmby PotPlayer instances are
isolated by their distinct PlaySession IDs. The matched session handle remains
inside the Bridge for the M2-017 timeline reader and is removed explicitly when
the playback lifecycle ends; it is not exposed by `/v1/status`.

For every matched session, the playback monitor reads GSMTC playback status,
rate, timeline start/end, reported position, seek range and last-updated time.
All timeline values are converted to non-negative ticks relative to the media
start and clamped to the validated duration. `Playing`, `Paused`, `Stopped`,
`Closed`, `Opened` and `Changing` remain distinct internal states. Position
changes more than two seconds away from expected normal progress are marked as a
seek; a playing timeline more than five seconds old is marked stale.

PotPlayer can briefly continue reporting `Playing` after a completed item while
resetting the timeline to zero. The monitor therefore preserves the previous
valid duration and reports `Ended` when a near-end timeline is followed by that
reset, or when `Stopped`/`Closed` is observed within two seconds of the end.
Playback and timeline events trigger immediate refresh, with a one-second poll
as a fallback. These snapshots stay inside the Bridge; Emby Playing, Progress
and Stopped calls begin with M2-018 rather than being inferred in this task.

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

The portable executable refreshes the per-user `newemby://` protocol whenever
the normal tray process starts, so moving the portable folder is repaired by
running the executable again. It can also be registered explicitly with
`--register-protocol`. It writes only below `HKCU\Software\Classes\newemby`,
quotes both the executable and `%1`, and needs no administrator access. Use
`--unregister-protocol` before removing or moving the portable executable.

The Windows build runs without a console window and remains available through a
notification-area icon. Its compact menu shows the Bridge version and an exit
action. Only one Bridge instance can run per user. For automated maintenance,
`NewEmby.PlayerBridge.exe --shutdown` signals the running instance to stop its
HTTP host and exit cleanly.
