# NewEmby

NewEmby is a modern Emby Web client with a protected Gateway and a Windows
local-player Bridge. It does not implement an HTML5 video player.

## Requirements

- Node.js 22.13.x 或更新的 Node.js 22 版本
- pnpm 11.13.1
- Docker with Compose for the production topology
- .NET 8 SDK before Player Bridge work starts in M2

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
