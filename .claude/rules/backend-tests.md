---
paths:
  - "backend/src/test/**"
---
# Backend tests

Levels and rules are in ADR 0011. One behaviour per method, backtick names that read as a sentence and contain
none of `. / < > : [ ] ; \`. Mocks only above the repository interfaces: repositories in service tests,
services in handler tests, none in repository, smoke or infrastructure tests. Docker is required (one
Testcontainers `mariadb:11.8` per test JVM); nothing is skipped without it.

- **Domain unit tests**: no framework.
- **Service unit tests**: MockK, `coEvery`/`coVerify` on the repository interfaces. MockK matchers such as
  `any()` or `isNull()` construct a real value class with a random primitive, so a validating `init` makes
  `coVerify` flaky; pass a concrete valid instance instead.
- **Repository tests**: `withFreshDatabase {}` / `countStatements {}` from
  `test/.../common/persistence/TestDatabase.kt`. One migrated database `media_tracker_test` per JVM;
  `withFreshDatabase` truncates every table in `allTables` except the seeded `game_platforms`, and Exposed's
  default database is pinned to that shared pool.
- **Handler tests** (`<feature>/api/<Feature>RoutesTest`, `auth/api/AuthRoutesTest`, root `RoutesTest`):
  `testApplication` + `handlerApp(auth, games, apiKeys, expansions, coverOptions, backup)` from `test/.../TestApp.kt`,
  which boots `configureHttp` with MockK services (every parameter defaulted) and `SessionStorageMemory`, no
  database; `loginAsMocked(auth)` logs in through the real `/login`. They own status codes, headers,
  (de)serialization, `PatchField` mapping (`coVerify` the domain value the service receives) and every negative
  path. MCP handler tests (`mcp/api/McpRoutesTest`) post raw JSON-RPC with the `Accept` and `Content-Type`
  headers the endpoint requires.
- **Smoke tests** (`<feature>/<Feature>SmokeTest`, root `ApplicationSmokeTest`): `testApplication` +
  `appWithUser` (real `module()` on the shared test MariaDB, `application-test.yaml` merged with the container
  coordinates, cheap `PasswordHasher(memoryKb = 1024, iterations = 1)` for the seeded user, `loginAs`,
  `decodeBody`, `jsonBody`). Happy paths only, at least one valid request per operation. `mcp/McpSmokeTest`
  drives the real module through the SDK's `kotlin-sdk-client`. `application-test.yaml` pins
  `STEAMGRIDDB_API_KEY` empty, so the cover endpoint's smoke path is the 503.
- **Infrastructure edge cases**: `DbSessionStorage`, `StatusPages` in an isolated app, `AppConfig` via
  `MapApplicationConfig`, `CreateUser.run()`.

The shared database survives between tests in a JVM: seed idempotently or clean up (`GamesTable.deleteAll()`);
`appWithUser` upserts its user's password hash because repository tests may have inserted the same username
with a fake hash. Raw inserts write every column (no column defaults, see `schema-migrations.md`).

An expression-bodied test whose last expression is `assertFailsWith` is not discovered by JUnit; use a block
body. Kover writes `backend/build/reports/kover/html/index.html` on every `build`; coverage is informational,
never add a threshold.
