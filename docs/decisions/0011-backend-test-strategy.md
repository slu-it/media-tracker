# 0011: Backend test strategy: six test levels, mocks only above the repository interfaces, coverage as information

Status: accepted, 2026-09

## Context

The backend has its first complete feature (`games`, records 0007 and 0010) and the tests that came with it:
value-class tests (`games/domain/GameValuesTest`), the Argon2id hasher test, the `PatchField` serializer test,
`SchemaDriftTest`, and two route suites (`LoginFlowTest`, `games/GamesApiTest`) that boot the real `module()` with
Ktor `testApplication` against H2. That suite was light: everything between the leaf types and HTTP (services,
Exposed repositories, session storage, status pages, DTO mappers) was exercised only indirectly, each API test
method bundled several behaviours, and some paths (`CreateUser`, session expiry, the 500 mapping, config
fast-fail, the login stylesheet) had no test at all. Books, Movies and Series will copy the `games` package and
its tests, so the levels, rules and non-goals are written down before the copies exist.

A second round (same month) reshaped the HTTP level. The two route suites had grown to 63 methods that all
booted the real `module()` on H2, so every serialization or status-code check also paid for Flyway, Argon2id and
SQL, and every business check was entangled with Ktor. The owner asked for a clean cut between "what we configure
Ktor to do for us" and "does the backend work end to end", with the login/session flow treated as a smoke test of
the whole application rather than of a feature.

Constraints: no DI container (`module()` wires by hand); repositories are interfaces in `domain` (0007: the
interface exists for the dependency direction, not for mocking); production runs MySQL 8 while tests run H2 in
MySQL mode; `application-test.yaml` names one shared in-memory H2 per test JVM; the runner is JUnit Platform
through `kotlin-test`.

## Decision

Six test levels, each answering one question, plus one guard test:

1. **Domain unit tests** (`<feature>/domain/*Test`, `auth/domain`; the `common/domain` primitives are covered from
   `games/domain/GameValuesTest` until a second feature needs them separately): value classes, entities,
   `Patch` / `*Patch.applyTo`, `PasswordHasher`. No Ktor, no Exposed, no database. Question: does invalid data
   fail with the right `InvalidValueException.field`, and do valid values round-trip?
1b. **Service unit tests with MockK** (`<feature>/domain/<Feature>ServiceTest`, `auth/domain/AuthServiceTest`):
   the service under test with its repository interfaces replaced by MockK mocks (`coEvery` / `coVerify` for
   suspend functions); real value classes and, for `AuthService`, the real `PasswordHasher` with cheap parameters.
   Question: does the service resolve, validate and delegate correctly (unknown platform ids, not-found, patch
   application, platform sorting, constant-time login, password zeroing) independent of SQL and HTTP?
2. **Repository tests** (`<feature>/persistence/Exposed*RepositoryTest`): a fresh, Flyway-migrated H2 per test
   method through `withFreshDatabase {}` (`test/.../common/persistence/TestDatabase.kt`, built on
   `DatabaseFactory.connect`), no Ktor. Question: does the SQL do what the repository interface promises
   (ordering `title, id`, paging totals, `update` returning `false` for a missing row, junction rows replaced on
   update, one platform query per page, expired-session cleanup)? `countStatements {}` from the same helper
   proves query counts.
3a. **API handler tests** (`<feature>/api/<Feature>RoutesTest`, `auth/api/AuthRoutesTest`, root `RoutesTest`):
   Ktor `testApplication` booting `Application.configureHttp(services, sessionConfig, sessionStorage)`, the part
   of `module()` above the persistence line, through `TestApp.kt`'s `handlerApp(auth, games)`: the real plugin set
   (Serialization, Monitoring, StatusPages, Sessions, Security) and the real routes, but the services are MockK
   mocks and sessions live in Ktor's `SessionStorageMemory`. No database is opened. `loginAsMocked(auth)` stubs
   `AuthService.login` and logs in through the real `/login`, so the signed cookie and the challenge are exercised.
   They assert what Ktor is configured to do: request deserialization including `PatchField` tri-state and the
   `invalid_body` cases, the exact domain value the handler hands to the service (`coVerify`), response JSON with
   explicit nulls, status codes, `Location` and cookie headers, 401 versus 302 challenges, paging parameter
   parsing, and how a `NotFoundException` or `InvalidValueException` thrown by the service surfaces. Question: is
   the HTTP contract in `docs/architecture.md` and `frontend/src/types/api.ts` still true, independent of the
   business logic behind it?
3b. **Smoke tests** (`<feature>/<Feature>SmokeTest` per business domain, root `ApplicationSmokeTest` for the
   composition root): Ktor `testApplication` booting the real `module()` on the shared H2 via `appWithUser` /
   `loginAs`. Happy paths only: every operation an API exposes has at least one valid request with a positive
   response, plus the request variations that matter (create with and without optionals, patch value versus patch
   null, a second page). `ApplicationSmokeTest` covers what no feature owns: login with a real Argon2id hash and
   the real `DbSessionStorage`, `/api/me`, logout, `/health`, the SPA at `/`. Question: does the wired application
   still work end to end? Negative paths do not belong here; they are handler tests (3a), service tests (1b) or
   repository tests (2).
4. **Infrastructure edge cases** (next to the code they test: `auth/api`, `plugins`, `config`, `auth/CreateUser`):
   `DbSessionStorage` (expiry with lazy delete, rebuilt principal, rejected non-session values), `StatusPages`
   for every mapping in an isolated application (uncaught exception, validation error, not found, bad body,
   unrouted paths, JSON versus plain text), `AppConfig` fast-fail and defaults through `MapApplicationConfig`,
   and the `CreateUser` CLI through its process-free `run()` (exit codes 0/1/2, `--reset-password`, short
   password). Question: does the plumbing fail the way the docs say? (The public login stylesheet is asserted in
   `auth/api/AuthRoutesTest`, level 3a, because it is part of the HTTP contract.)

Plus **`SchemaDriftTest`** (kept as is): migrate a fresh H2, then Exposed must have no statements left for
`allTables`, and `flyway_schema_history` must contain one successful row per `V*.sql`.

Rules for every level:

- **One behaviour per test method**, named in backticks as a sentence that states the behaviour
  (`` `update returns false when the game no longer exists` ``). Several assertions are fine when they describe
  the same behaviour; a second behaviour is a second method. The `--tests 'Class.method name'` recipe in
  CLAUDE.md relies on these names. Names may not contain `. / < > : [ ] ; \` (write `0_25`, "api games").
- **Mocks only above the repository interfaces.** MockK (`io.mockk:mockk`, test scope) is the mocking library.
  It replaces repository interfaces in level 1b tests and the services (`AuthService`, `GameService`) in level 3a
  tests. It is not used below that line: repository tests run the real SQL on H2 (level 2), smoke tests boot the
  real `module()` (level 3b), and infrastructure tests use the real plugin or class (level 4). Mocking Exposed,
  Ktor plugins, `DbSessionStorage` or a repository inside a smoke test hides exactly what those levels exist to
  verify. Handler tests never mock a Ktor plugin either: they boot the real `configureHttp`, only the services
  behind the routes are mocks.
- **Handler tests own the negative paths, smoke tests own the happy paths.** A 400, 401, 404 or a malformed body
  is asserted once, in a handler test with a mocked service (and, for the exception mapping matrix, in
  `plugins/StatusPagesTest`). A smoke test that fails because of a status code is a smoke test doing a handler
  test's job.
- **H2 in MySQL mode is the test database**, shared (levels 3b and 4 through `module()`) or fresh per test
  (level 2, `SchemaDriftTest`, `CreateUser`). The MySQL/H2 divergence risk is accepted and bounded by
  `SchemaDriftTest` (DDL) and the migration rules in CLAUDE.md; do not assert engine-specific behaviour such as
  collation case-sensitivity.
- **The shared H2 survives between tests in one JVM.** Seed idempotently (`appWithUser` creates the user only
  if missing) or clean up in the seed lambda (`GamesTable.deleteAll()`). Tests that need isolation use
  `withFreshDatabase {}`.
- **Test users hash with `PasswordHasher(memoryKb = 1024, iterations = 1)`**; production parameters are for the
  hasher's own test only.
- **Coverage is information, not a gate.** Kover (`org.jetbrains.kotlinx.kover`) writes HTML and XML reports as
  part of `check`, so every `./gradlew build` refreshes `backend/build/reports/kover/html/index.html`. There is
  no `verify { rule { minBound } }`. Generated `*$$serializer` classes are excluded. The frontend follows the same
  rule: `pnpm test` is `vitest run --coverage` with `@vitest/coverage-v8` (pinned to the Vitest version), so
  `:frontend:pnpmTest` refreshes `frontend/build/coverage/index.html` on every build; no `thresholds`; excluded on
  top of Vitest's defaults are the tests and test helpers, the type-only `types/`, `main.tsx` and `*.d.ts`. The
  frontend side of the rule is cross-referenced from decision record 0008.

## Alternatives not taken

- **Hand-written fakes instead of MockK** for the service tests. Fakes encode behaviour and need no library, but
  every feature would grow its own fake per repository interface, and the fakes would need tests of their own
  once they hold state. MockK keeps the service tests short and lets `coVerify` pin what was delegated.
- **Mocks everywhere.** Rejected: a smoke test with a mocked repository or a repository test with a mocked
  `Database` proves nothing about the SQL, the wiring or the error mapping, which is what levels 2, 3b and 4 are
  for.
- **One HTTP level that does both** (the first version of this record: "API contract tests" booting `module()`
  for every behaviour). Rejected after it reached 63 methods: each serialization check paid for the database, and
  a business regression and a Ktor misconfiguration failed the same test. The split needs one seam,
  `configureHttp`, and one rule about who owns negative paths.
- **Handler tests without the plugins** (mounting a single `Route.gameRoutes(mock)` in a bare application).
  Faster still, but they would skip `StatusPages`, `Sessions`, `Security` and the JSON 404 catch-all, which is
  most of what "what Ktor does for us" means. `configureHttp` keeps them in.
- **Interfaces for the services so they can be mocked.** Not needed: MockK mocks final classes, and 0007's rule
  that interfaces exist for the dependency direction, not for mocking, stays.
- **No mocking library at all.** Considered because the services are thin CRUD today; rejected by the owner, who
  wants the service layer tested in isolation from the start so the next media kinds copy that too.
- **Testcontainers with a real MySQL 8** for levels 2 and 3. Removes the H2 divergence but costs Docker in CI and
  locally, seconds per JVM start, and the "Gradle is the only tool you need" promise. Revisit if a migration ever
  passes the drift test and still fails on the Pi.
- **Ktor tests of single routes** with a single plugin installed, as the general pattern. Level 4 may do this
  when that plugin's behaviour is the subject (`StatusPagesTest`); levels 3a and 3b always boot the full plugin
  set.
- **A coverage threshold from day one.** With API tests driving most lines the number would be high and say
  little. Trigger to add a `verify` rule: a regression a coverage drop would have shown, or the second media kind
  landing so per-feature numbers become comparable. Start with a per-package bound on `*.domain`, not a total.
- **Kotest or the JUnit 5 API directly.** `kotlin-test` is enough for one-behaviour tests and keeps the
  dependency list short; revisit if data-driven tests become common.

## Consequences

- A new media kind copies six things from `games`: `<kind>/domain/<Kind>ValuesTest` (level 1),
  `<kind>/domain/<Kind>ServiceTest` with MockK (level 1b), `<kind>/persistence/Exposed<Kind>RepositoryTest` on
  `withFreshDatabase` (level 2), `<kind>/api/<Kind>RoutesTest` on `handlerApp` with a mocked service (level 3a),
  `<kind>/<Kind>SmokeTest` with a `loggedInClient` helper that cleans its tables (level 3b), and seed constants
  when it has reference data (`SeededPlatforms` pattern). It also adds its service to `Services` and a parameter
  to `handlerApp`. `TestApp.kt` and `TestDatabase.kt` change only when every feature needs it.
- `Application.kt` gains `class Services` and `Application.configureHttp(services, sessionConfig, sessionStorage)`;
  `module()` is the production wiring that builds both from config and Exposed and then calls `configureHttp`.
  This is the only main-code change the split needed.
- `LoginFlowTest` and `GamesApiTest` are gone; their behaviours live in `auth/api/AuthRoutesTest`, root
  `RoutesTest`, root `ApplicationSmokeTest`, `games/api/GameRoutesTest` and `games/GamesSmokeTest`. The
  `--tests` recipes in CLAUDE.md name the new classes.
- `CreateUser` exposes `internal fun run(args, env, readPassword, out, err, hasher): Int`; `main` is a one-statement
  `exitProcess(run(...))` wrapper. The CLI contract (exit codes, messages) is unchanged. Writing the first test for
  it found and fixed a latent defect: a pool of one connection made Flyway hang on a fresh database.
- The reviewer checklist gains: test names read as sentences, one behaviour per method, MockK only above the
  repository interfaces, negative paths in handler tests and happy paths in smoke tests, shared H2 seeded
  idempotently or cleaned, no `verify` threshold added silently.
- `./gradlew build` gets `koverHtmlReport` and `koverXmlReport`; the reports land in `backend/build/reports/kover/`,
  the frontend's V8 report in `frontend/build/coverage/`. No CI workflow change.
