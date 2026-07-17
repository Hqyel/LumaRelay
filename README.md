# NewEmby

NewEmby is a modern Emby Web client with a protected Gateway and a Windows
local-player Bridge. It does not implement an HTML5 video player.

## Requirements

- Node.js 22.13.x 或更新的 Node.js 22 版本
- pnpm 11.13.1
- Docker with Compose for the production topology
- .NET SDK 8.0.422 for Player Bridge development

The checked-in package manager and lock file are authoritative. On Windows, use
`pnpm.cmd` if PowerShell execution policy blocks `pnpm.ps1`. If the bundled
Corepack has stale signing keys, run commands with
`npx --yes pnpm@11.13.1 <command>`.

## Local development

1. Copy `.env.example` to `.env` when overriding development defaults. Gateway
   loads the root file automatically; explicit process variables take priority.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Start Web and Gateway with `pnpm dev`.
4. Run the non-Docker startup check with `pnpm smoke:local`.
5. Run the complete local quality gate with `pnpm verify:local`.

Install the Playwright Chromium and Firefox runtimes once with
`pnpm exec playwright install chromium firefox`. `pnpm test:e2e` keeps the pixel
baselines on Chromium, while `pnpm test:compat` checks Chromium and Firefox
functionality, keyboard behavior, layout overflow and console errors. On Windows
with Chrome and Edge installed, run `pnpm test:compat:local` for the
four-browser desktop compatibility gate.

The repository `global.json` pins the Player Bridge SDK. Build and test it with
`pnpm --filter @newemby/player-bridge build` and
`pnpm --filter @newemby/player-bridge test`. Create the Windows self-contained
single-file artifact with `pnpm bridge:publish`; output is written to
`apps/player-bridge/artifacts/win-x64` and remains untracked.

The current Bridge distribution is portable: place the published executable in a
stable directory, run it directly, and use `--register-protocol` once from that
location. Run `--shutdown` and `--unregister-protocol` before moving or deleting
it. An installer, uninstaller and automatic updater are intentionally deferred.

To verify a real Emby server without persisting credentials, set
`EMBY_SMOKE_BASE_URL` and optionally both `EMBY_SMOKE_USERNAME` and
`EMBY_SMOKE_PASSWORD` in the command process, then run `pnpm smoke:emby`. The
authenticated path checks the current user, views, filtered media items, one
image and logout. It prints only version, status and counts, and always attempts
logout in `finally`; never place these temporary values in `.env`.

The explicitly enabled `pnpm smoke:emby:write` additionally requires
`EMBY_WRITE_SMOKE_CONFIRM=true` and both temporary credential variables. It
selects a zero-progress unplayed item, toggles its favorite state, verifies the
write, then repeats the check for played state. It restores both original states
in `finally` and then logs out. The command does not print the server address,
account, item metadata, cookie or token.

The development Web server is served by Vite. Production uses the same public
origin for Web and `/api/*`; the browser never receives the Emby access token.
The smoke command uses isolated ports and a temporary SQLite database, then
stops both services automatically.

## Production topology

`compose.yaml` starts Caddy, the static Web container, Gateway and a persistent
SQLite volume. Only Caddy publishes host ports. Set `NEWEMBY_DOMAIN` to a DNS
name whose A/AAAA record points at the deployment before starting:

```shell
docker compose up --build -d
```

Do not commit `.env`, database files, Emby tokens or generated secrets.

Compose always runs Gateway in production mode and therefore rejects the
development secrets and HTTP origins from `.env.example`. Before deployment, set
HTTPS origins and generate independent secrets, for example with
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
for `SESSION_SECRET` and
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
for `TOKEN_ENCRYPTION_KEY`. `EMBY_BASE_URL` must appear in the exact
`EMBY_ALLOWED_SERVER_ORIGINS` list. Migration commands create a consistent
SQLite backup beside the database before an actual up or down migration and
retain the five newest backups.

## Development and version conventions

- Keep `main` releasable and use short-lived branches named
  `<type>/<task-id>-<summary>`, for example `feature/M1-013-home-page`.
  Codex-created branches use the required `codex/` prefix.
- Each change handles one progress task or a tightly coupled group. Update
  `docs/DEVELOPMENT_PROGRESS.md` in the same change after verification.
- Commit messages follow Conventional Commits and include the task ID in the
  scope, for example `chore(M0-001): initialize pnpm workspace`.
- Allowed commit types are `feat`, `fix`, `docs`, `test`, `refactor`, `perf`,
  `build`, `ci` and `chore`.
- Versions follow Semantic Versioning. Milestone releases are `v0.1.0` for
  M0-M1, `v0.2.0` for M2, `v0.3.0` for M3, `v0.4.0` for M4, `v0.5.0` for M5 and
  `v1.0.0` after the M6 scope is accepted.
- Create release tags and changelog entries only after the corresponding release
  gate passes. Do not tag partially verified work.
