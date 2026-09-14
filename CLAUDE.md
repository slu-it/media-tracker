# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Self-hosted media-list tracker: one fat JAR (Ktor backend + compiled React SPA + hand-written login page)
running on a Raspberry Pi against a remote MySQL 8. Two Gradle projects, `backend` and `frontend`; Gradle
is the only tool you need installed besides JDK 25 (Node 24 and pnpm 10 are downloaded by Gradle).

Phase 1 (build, login gate, sessions) is done. Phase 2 (media domain: lists, items, statuses) is not
started: `backend/.../media/` and `frontend/src/features/*` are intentional empty placeholders.

Detailed docs already exist and are kept current; read them before larger changes:
`README.md` (setup/run), `docs/architecture.md` (request flow, module map, build pipeline, migration
rules), `docs/decisions/000N-*.md` (ADRs). Add a new numbered ADR for any decision of similar weight.
`tmp/` is gitignored scratch (contains the original project description).

## Commands

| Goal | Command |
|---|---|
| Everything: both projects, lint, format checks, all tests, fat JAR | `./gradlew build` |
| Backend tests (H2 in MySQL mode, no DB needed) | `./gradlew :backend:test` |
| One backend test class | `./gradlew :backend:test --tests 'de.sluit.mediatracker.LoginFlowTest'` |
| One backend test method (backtick names, quote them) | `./gradlew :backend:test --tests 'de.sluit.mediatracker.LoginFlowTest.anonymous api call gets json 401'` |
| Frontend tests (Vitest) | `./gradlew :frontend:pnpmTest` or `cd frontend && pnpm test` |
| One frontend test file | `cd frontend && pnpm vitest run src/App.test.tsx` |
| Frontend type-check only | `cd frontend && pnpm typecheck` (`pnpm build` runs `tsc -b` first) |
| Kotlin lint / auto-format | `./gradlew :backend:ktlintCheck` / `./gradlew :backend:ktlintFormat` |
| Frontend lint / format | `cd frontend && pnpm lint` / `pnpm format:check`; fix with `pnpm lint:fix` / `pnpm format` (Gradle: `:frontend:pnpmLint`, `pnpmFormatCheck`, `pnpmLintFix`, `pnpmFormat`) |
| Backend dev run (serves last built frontend) | `./gradlew :backend:run` (needs `DB_URL`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`) |
| Frontend hot reload | `cd frontend && pnpm dev` (port 5173, proxies `/api`, `/login`, `/logout`, `/health` to `:8080`) |
| Full local end-to-end | `./build-and-start-locally.sh` (starts Docker MySQL, builds, ensures user `slu`, runs on :8080); `MT_SKIP_BUILD=1` reuses the last JAR |
| Release JAR | `./gradlew :backend:buildFatJar` then `backend/build/libs/media-tracker.jar` |
| Create/reset a user (no self-registration) | `java -cp backend/build/libs/media-tracker.jar de.sluit.mediatracker.auth.CreateUser <name> [--reset-password]` |

**Lint and format checks fail the build.** `./gradlew build` runs ktlint (`:backend:ktlintCheck`), ESLint
(`:frontend:pnpmLint`) and a Prettier check (`:frontend:pnpmFormatCheck`) via each project's `check` task.
Before committing, auto-fix with `./gradlew :backend:ktlintFormat` and `cd frontend && pnpm format && pnpm lint:fix`.
ktlint uses the `intellij_idea` code style from `.editorconfig` (4 spaces, 120 columns) with `no-unused-imports`
explicitly enabled (it is off by default in ktlint 1.x); Prettier uses
`printWidth: 120` with 2-space indentation. ESLint config is `frontend/eslint.config.js` (flat config,
typescript-eslint non-type-aware recommended, react-hooks, react-refresh, eslint-config-prettier).
detekt is intentionally absent until detekt 2.0 (Kotlin 2.4 support) is GA, see `docs/decisions/0005-linting.md`.
The ktlint plugin is only applied in `:backend`; the root and frontend Gradle scripts are not linted by the build.

**CI.** `.github/workflows/pr.yml` (pull requests to `master`) and `master.yml` (push to `master`) both run
`./gradlew build` on JDK 25 with Gradle and Node/pnpm caches; `master.yml` uploads `backend/build/libs/media-tracker.jar`
as the `media-tracker-jar` artifact. pnpm runs with a frozen lockfile in CI, so commit `pnpm-lock.yaml` changes.

Gradle runs with configuration cache, build cache and parallel on. `frontend/build.gradle.kts` must keep
`node.version` and `pnpmVersion` as literal strings (node-gradle 7.1.0 configuration-cache bug).

## Architecture essentials

**Frontend → backend handoff.** `:frontend` exposes Vite's output (`frontend/build/dist`) as a consumable
Gradle configuration `frontendDist`; `:backend` resolves it as a dependency and copies it into
`build/resources/main/app/` during `processResources`. Never reference `:frontend` tasks from `:backend`,
and never write into `backend/src/main/resources/app/` (gitignored, must stay empty).

**Backend wiring** (`Application.kt`, `module()`): config → `DatabaseFactory.connect` → services →
plugins (Serialization, Monitoring, StatusPages, Sessions, Security) → routes (`loginRoutes`,
`apiRoutes`, `webRoutes`). Config is typed in `config/AppConfig.kt` from `application.yaml`, where every
secret is an env-var reference (`"$VAR"` required, `"$VAR:default"` optional).

**Two auth tiers on one port.** Public: `/login`, `/login/static/*`, `/logout`, `/health`. Everything
else (SPA with `index.html` fallback, `/api/**`) sits inside `authenticate(SESSION_AUTH)`. The challenge
in `plugins/Security.kt` returns JSON 401 for `/api/*` and a 302 to `/login` otherwise. `apiRoutes` ends
with a `{...}` catch-all so unknown API paths are JSON 404s instead of the SPA. New API routes go under
that `authenticate` block in `api/ApiRoutes.kt`.

**Sessions** live in the `sessions` table; the cookie `MT_SESSION` holds only an HMAC-signed id.
`DbSessionStorage` rebuilds the `UserSession` principal per request and lazily deletes expired rows.
Passwords are Argon2id PHC strings (`auth/PasswordHasher.kt`).

**Database access.** Exposed 1.5 with `org.jetbrains.exposed.v1.*` package roots; timestamps are
`kotlin.time.Instant`. JDBC is blocking, so route code must call `dbQuery { }` (`db/DatabaseFactory.kt`),
which runs the transaction on `Dispatchers.IO`. Repositories expose `*Blocking` variants for use inside
an existing transaction (tests, `CreateUser`).

**Schema changes are a two-file commit.** Flyway SQL in `backend/src/main/resources/db/migration/` is
the source of truth; `db/Tables.kt` mirrors it and must be added to `allTables`. `SchemaDriftTest`
migrates a fresh H2 and fails if Exposed would still want to change anything. Rules:
- Name scripts `V<n>__<snake_case>.sql`; never edit an applied script, add `V<n+1>`.
- SQL must run on MySQL 8 and H2 MySQL mode. Use `${timestamp_type}` for timestamp columns (resolved to
  `DATETIME(6)` in prod, `TIMESTAMP(9)` in tests).
- Every FK column gets an explicit `INDEX` in SQL and `.index()` in Kotlin, or the drift test fails on H2.
- Migrations run at startup; the app never alters the schema itself.

**DTO mirroring.** `@Serializable` DTOs in `backend/.../api/Dtos.kt` are hand-mirrored in
`frontend/src/types/api.ts`. Change both together. `frontend/src/api/client.ts` (`apiFetch`) redirects to
`/login` on 401 and throws `ApiError` on other non-2xx.

**Backend tests** use Ktor `testApplication` with `application-test.yaml` (H2 in-memory, no
`ktor.application.modules` entry, so tests call `module()` explicitly) and seed users with a cheap
`PasswordHasher(memoryKb = 1024, iterations = 1)`. See `LoginFlowTest.appWithUser` for the pattern.
Frontend tests use Vitest + Testing Library with jsdom and mock `globalThis.fetch`.

## Version policy

`gradle/libs.versions.toml` is the single source for JVM versions; npm packages are pinned exactly in
`frontend/package.json` (no `^` ranges). Stay on the current majors and take the newest release within
each; do not bump majors (e.g. pnpm 12, TypeScript 7, Logback 1.6) without asking.
