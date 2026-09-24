# CLAUDE.md

Guidance for Claude Code in this repository. Only what holds for every task lives here.

## What this is

Self-hosted media-list tracker: one fat JAR (Ktor backend + compiled React SPA + hand-written login page) on a
Raspberry Pi against MariaDB 11.8. Two Gradle projects, `backend` and `frontend`; JDK 25 and Docker (backend
tests) are the only local requirements, Node 24 and pnpm 10 are downloaded by Gradle. Games is the only
implemented media kind (`backend/.../games/`, `frontend/src/features/games/`) and the template for Books, Movies
and Series.

## Where to read more

- `docs/index.md` is the entry point: a table of features with their pages under `docs/features/`, and a table of
  every ADR in `docs/decisions/`. Read it before touching a feature you do not know.
- `docs/architecture.md` (request flow, module maps, API table, build pipeline, runtime) and `README.md`
  (setup, run, deploy, MCP client).
- Add a numbered ADR for any decision of weight; find the next free number across all git refs, numbers are
  claimed on branches. A feature ticket adds a row to `docs/index.md` and a page in `docs/features/`, not prose
  here.

## Commands

| Goal | Command |
|---|---|
| Everything: both projects, lint, format checks, all tests, fat JAR | `./gradlew build` |
| Backend tests (needs Docker: one Testcontainers `mariadb:11.8` per test JVM, never skipped) | `./gradlew :backend:test` |
| One backend test class | `./gradlew :backend:test --tests 'de.sluit.mediatracker.ApplicationSmokeTest'` |
| One backend test method (backtick names, quote them) | `./gradlew :backend:test --tests 'de.sluit.mediatracker.auth.api.AuthRoutesTest.anonymous api call gets json 401'` |
| Backend coverage report (Kover, also written by every `build`/`check`; no threshold) | `./gradlew :backend:koverHtmlReport`, then open `backend/build/reports/kover/html/index.html` |
| Frontend tests (Vitest; also writes the V8 coverage report, no threshold) | `./gradlew :frontend:pnpmTest` or `cd frontend && pnpm test`, then open `frontend/build/coverage/index.html`. The Gradle task is up-to-date-checked like `:backend:test`; `--rerun-tasks` forces a rerun |
| One frontend test file | `cd frontend && pnpm vitest run src/App.test.tsx` |
| Frontend type-check only | `cd frontend && pnpm typecheck` (`pnpm build` runs `tsc -b` first) |
| Kotlin lint / auto-format | `./gradlew :backend:ktlintCheck` / `./gradlew :backend:ktlintFormat` |
| Frontend lint / format | `cd frontend && pnpm lint` / `pnpm format:check`; fix with `pnpm lint:fix` / `pnpm format` (Gradle: `:frontend:pnpmLint`, `pnpmFormatCheck`, `pnpmLintFix`, `pnpmFormat`) |
| Dev loop with live reload (backend auto-reload + Vite HMR) | `./start-dev.sh` (Docker MariaDB, `:backend:run -Pmt.dev=true`, `:backend:classes -t -Pmt.dev=true`, `pnpm dev`; open :5173) |
| Backend dev run (serves last built frontend) | `./gradlew :backend:run` (needs `DB_URL`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`; optional `STEAMGRIDDB_API_KEY` enables the cover picker) |
| Frontend hot reload | `cd frontend && pnpm dev` (port 5173, proxies `/api`, `/login`, `/logout`, `/health` to `:8080`) |
| Full local end-to-end (production-like JAR) | `./build-and-start-locally.sh` (starts Docker MariaDB, builds, ensures user `slu`, runs on :8080); `MT_SKIP_BUILD=1` reuses the last JAR. Shared env/helpers in `local-env.sh` |
| Release JAR | `./gradlew :backend:buildFatJar` then `backend/build/libs/media-tracker.jar` |
| Container image (JAR first; single-arch for the host, local testing only) | `./gradlew :backend:buildFatJar && docker build -t media-tracker:local .` |
| Run that image against the local MariaDB | `source local-env.sh && docker compose up -d --wait mariadb && docker run --rm --network host -e DB_URL -e DB_USER -e DB_PASSWORD -e SESSION_SECRET -e SESSION_SECURE media-tracker:local` |
| Create/reset a user (no self-registration) | `java -cp backend/build/libs/media-tracker.jar de.sluit.mediatracker.auth.CreateUser <name> [--reset-password]` |

## Rules that apply everywhere

- **Lint and format checks fail the build** (ktlint, ESLint, Prettier via each project's `check`). Before handing
  over, auto-fix with `./gradlew :backend:ktlintFormat` and `cd frontend && pnpm format && pnpm lint:fix`.
- **Paired changes, finish both halves** or say which is open:
  - `*Dtos.kt` <-> `frontend/src/types/api.ts` (hand-mirrored DTOs)
  - new migration `V<nnn+1>__*.sql` (never edit an applied one) <-> `*Table.kt` + entry in `allTables` (`Schema.kt`)
  - `frontend/src/i18n/en.json` <-> `de.json` (same key set)
  - new `<feature>/api/*Routes.kt` <-> mounted in `apiRoutes` (root `Routes.kt`) inside `authenticate`, before the catch-all
  - backend value class rule (`requireValid`) <-> frontend validator in `features/<kind>/domain/` + self-validating field component
- **Onion layers**: `api -> domain <- persistence` (+ `integration -> domain`); the domain imports no
  Ktor/Exposed/kotlinx and only domain types cross layers. Copy the `games` package for a new media kind.
- **Backend tests need Docker** and are never skipped. The test MariaDB is shared per JVM: seed idempotently or
  clean up.
- Never write into `backend/src/main/resources/app/` (Gradle copies the built SPA there); never pass
  `-Pmt.dev=true` to `build` or `buildFatJar`.
- **Versions**: stay on the current majors, take the newest release within each, no major bumps without asking;
  npm packages are pinned exactly. Details in `.claude/rules/build-ci-deploy.md`.

## Git

- Never commit, amend or push on your own. The owner decides how, when and how often to commit; finish a work
  package with a verified working tree and a summary, and commit only when explicitly asked, in the form asked.

## Delegation

- Main session: planning, decisions, synthesis, and every edit to `CLAUDE.md`, `docs/`, `README.md` and
  `.claude/` (the implementer hook denies those). Do not read whole source files or run tests directly.
- Use Explore for any codebase search, implementer for scoped edits, test-runner for verification, reviewer
  before finishing (definitions in `.claude/agents/`).
- Prefer several parallel subagents for independent investigations, but only one subagent that runs Gradle at a
  time: concurrent Gradle invocations contend on the daemon lock and the configuration cache.
