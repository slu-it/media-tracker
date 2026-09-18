# 0010: Domain-first top-level packages: `auth` and `common` as onion modules, feature-free shared code

Status: accepted, 2026-09

## Context

With MT-001 nearly complete, `games` follows decision record 0007 (`games.{api,domain,persistence}`), but the
packages around it still had the phase 1 shape, organised by technical role rather than by domain:

- `db/Tables.kt` held only the auth tables (`users`, `sessions`) and the `allTables` registry, so the generic
  persistence package imported `games.persistence` (a package cycle `db <-> games.persistence`).
- `auth/` was flat: routes, the Ktor session storage, services, Exposed repositories and the `CreateUser` CLI in
  one package, with the tables elsewhere.
- `plugins/` mixed generic Ktor plugins (Serialization, Monitoring, StatusPages) with the auth-specific ones
  (Sessions, Security), and `/api/me` with its DTO lived in the shared `api` package.

The owner wants the first package layer to consist of coherent domains: business domains (`games`, later
`books`, `movies`, `series`) and technical but coherent domains (`auth`, `config`, ...).

## Decision

- **First layer = domains.** Business domains and `auth` are onion modules `{api,domain,persistence}` exactly
  as in 0007. `CreateUser` stays at the `auth` root so the documented class name
  `de.sluit.mediatracker.auth.CreateUser` keeps working.
- **`common` is an onion too.** The shared code uses the same three layers as a feature: `common/domain`
  (framework-free primitives: exceptions, `requireValid`, paging types, `Patch`), `common/api` (shared DTOs,
  `PatchField` + serializer, `?page`/`?pageSize` parsing) and `common/persistence` (HikariCP, Flyway, `dbQuery`;
  formerly `db/`). A feature layer depends only on the matching or inner `common` layer.
- **Shared packages never import a feature.** `common`, `plugins` (Serialization, Monitoring, StatusPages) and
  `config` know no feature. The files that know every feature live in the package root as the composition
  root: `Application.kt` (wiring), `Routes.kt` (`apiRoutes` mounts `meRoutes()` and `gameRoutes()` under the
  authenticated `/api` prefix plus the JSON 404 catch-all; `webRoutes` serves `/health` and the session-gated
  SPA) and `Schema.kt` (table registry). The former `web/` package is gone.
- **Table registry at the composition root.** `allTables` lives in `Schema.kt` next to `Application.kt`.
  `DatabaseFactory.connect` opens the pool, migrates and binds Exposed; `module()` then calls
  `DatabaseFactory.warnOnSchemaDrift(database, allTables)`, and `SchemaDriftTest` passes `allTables` explicitly.
  `CreateUser` connects without the drift warning (the server logs it at every start).
- **`auth` layering.** `auth.api` owns everything Ktor: `LoginRoutes`, `MeRoutes` (+ `MeResponse` in
  `AuthDtos.kt`), `Security` (`SESSION_AUTH`, the session authentication provider and its 401/302 challenge),
  `Sessions` (cookie + storage plugin), the principal `UserSession` and `DbSessionStorage`. `auth.domain` owns
  `AuthService` (`login` returns the domain `User`, the route maps it to `UserSession`), `PasswordHasher`,
  `User` + `UserRepository` and `StoredSession` + `SessionRepository` as interfaces. `auth.persistence` owns
  `UsersTable`, `SessionsTable`, `ExposedUserRepository` and `ExposedSessionRepository`; the `*Blocking`
  helpers for use inside an existing transaction exist only on the Exposed classes.
- **Domain purity, clarified.** A `domain` package imports neither Ktor nor Exposed nor kotlinx.serialization.
  Pure libraries such as Bouncy Castle (Argon2id) or slf4j are fine.
- **Naming.** Exposed table objects are `<Name>Table` everywhere (`UsersTable`, `SessionsTable`, `GamesTable`),
  which also ends the clash between the old `Sessions` table object and Ktor's `Sessions` plugin.
- `SESSION_AUTH` is defined where the provider is installed (`auth/api/Security.kt`); the root `Routes.kt` imports
  it from there for both the `/api` prefix and the SPA.

## Alternatives not taken

- Keeping the registry or the `/api` mount point inside `common`: both import feature packages and would
  recreate the `common <-> feature` cycle this record removes. Runtime self-registration of tables: hidden
  global state, order-dependent, and `SchemaDriftTest` would have to boot the whole module to see the list.
- A neutral home for `SESSION_AUTH` in `common/api`: hides the dependency instead of removing it; the constant means
  nothing until `configureSecurity` has run.
- Merging `common/api` and `plugins` into one HTTP package: considered, rejected by the owner; small, clearly
  named packages read better than one grab-bag.
- Leaving `auth` flat and only pulling its tables in: less churn, but `auth` would stay the one module that does
  not follow 0007 and could not serve as a second template.

## Consequences

- A new media kind adds one line to `Schema.kt` and its own `<kind>/{api,domain,persistence}`; nothing else in
  the shared packages changes except the mount line in `apiRoutes` (root `Routes.kt`).
- Paths quoted in 0001 (`db/DatabaseFactory.kt`), 0004 (`db/Tables.kt`) and 0007 (`db/Tables.kt`, the old
  top-level `api/*` files) are historical; this record and `docs/architecture.md` name the current ones.
- The reviewer checklist reads "domain free of Ktor/Exposed/kotlinx.serialization", not "free of all libraries".
