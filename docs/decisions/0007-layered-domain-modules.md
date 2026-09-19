# 0007: Feature-first backend modules with onion layers and self-validating value classes

Status: accepted, 2026-09; table registry location and the `auth` layout amended by 0010

## Context

MT-001 (games) is the first domain feature; Books, Movies and Series will follow the same shape. Phase 1 code is
organised by technical role (`auth/`, `api/`, `db/`), which works for one cross-cutting concern but would spread
every media kind over three top-level packages. We also want the request path to be layered so that HTTP, business
rules and SQL can each change without touching the other two, and so that invalid data cannot exist past the API
boundary.

## Decision

- **One package per feature, three sub-packages per layer:** `de.sluit.mediatracker.games.{api,domain,persistence}`.
  Dependencies point inward only: `api -> domain`, `persistence -> domain`, `domain -> nothing framework-specific`
  (no Ktor, Exposed or kotlinx.serialization imports). Cross-feature primitives (pagination, `Patch`, the domain
  exceptions) live in `de.sluit.mediatracker.common`; DTOs that every feature shares (`ErrorResponse`,
  `PageResponse<T>`) stay in `api/Dtos.kt` because that is what the frontend mirrors.
- **Each layer owns its types.** `api`: `@Serializable` request/response DTOs plus `toNewGame()/toPatch()/toResponse()`
  mappers. `domain`: entities (`Game`), commands (`NewGame`, `GamePatch`) and value classes. `persistence`: the
  Exposed `Table` object and a row mapper. Only domain types cross a layer boundary.
- **Self-validating `@JvmInline value class`es** (`Title`, `ReleaseYear`, `CoverImageUrl`, `GameId`, `PageNumber`,
  `PageSize`). The `init` block calls `requireValid(field, condition) { reason }`, which throws
  `InvalidValueException(field, reason)`. Constructing the value *is* the validation, so a handler converts the DTO
  and never checks anything itself; the persistence layer re-runs it on read so corrupt rows fail loudly.
- **Repository interface in `domain`, implementation in `persistence`** (`GameRepository` / `ExposedGameRepository`).
  There is no DI container; `Application.module()` wires `GameService(ExposedGameRepository())` by hand. The
  interface exists for the dependency direction, not for mocking.
- **Routes are contributed per feature.** `games/api/GameRoutes.kt` defines `Route.gameRoutes(service)`;
  `api/ApiRoutes.kt` only mounts it inside the authenticated `/api` prefix, before the JSON-404 catch-all.
  Tables stay next to their repository (`games/persistence/GamesTable.kt`) and are registered in `allTables`
  (`Schema.kt` in the package root, see 0010) for the drift check.
- **Error mapping is central** (`plugins/StatusPages.kt`), by exception type:

  | Exception | Status | `error` code | `message` |
  |---|---|---|---|
  | `InvalidValueException` | 400 | `validation_error` | `"<field>: <reason>"` |
  | Ktor `BadRequestException` (malformed / ill-typed JSON) | 400 | `invalid_body` | first line of the serializer message |
  | Ktor `ContentTransformationException` (no body) | 400 | `invalid_body` | none |
  | `NotFoundException` | 404 | `not_found` | none |
  | anything else | 500 | `internal_error` | none |

  `ErrorResponse.message` is omitted from the JSON when absent (`@EncodeDefault(NEVER)`), so existing bodies are
  unchanged.
- **Partial updates use a tri-state.** Optional fields in PATCH bodies are `PatchField<T>` (absent / `null` / value,
  `api/PatchField.kt`, a custom serializer with a nullable descriptor) and become the domain `Patch<T>`
  (`Unchanged` / `Change(value?)`). Required fields are plain nullable DTO properties where `null` means
  "unchanged". `explicitNulls` stays at its default, so responses spell out `"coverImageUrl": null`.
- **UUID ids are stored as `CHAR(36)`** (hex-dash form) rather than Exposed's `uuid()`: the latter is `BINARY(16)`
  on MariaDB but `UUID` on H2, which fails the drift test, and the text form is readable in SQL tools. `GameId` wraps
  `kotlin.uuid.Uuid` (stable since Kotlin 2.4); DTOs carry the id as a `String` because the kotlinx Uuid serializer
  is still experimental.
- **Paging contract:** `?page=` (1-based, default 1) and `?pageSize=` (default 50, max 200) into `PageRequest`;
  responses are `PageResponse<T>` with `items, page, pageSize, totalItems, totalPages` (`totalPages` is 0 for an
  empty list; a page past the end is a 200 with no items). Lists are ordered deterministically (`title, id`).
- **Enums travel by constant name** (`"PLAYSTATION"`), both in JSON and in the `VARCHAR` column; display labels
  are code on both sides.

## Consequences

- A new media kind is a copy of the `games` package plus one `V<nnn>__*.sql`, one line in `allTables`, one line in
  `apiRoutes`, one service in `module()`, and the DTO mirror in `frontend/src/types/api.ts`.
- HTTP status semantics are decided once, in `StatusPages`; handlers never build error responses by hand.
- Bare `IllegalArgumentException`s (from `require`) are *not* mapped to 400 on purpose; use `requireValid`.
- `GameService.update` is load-apply-save in two transactions. Fine for a single-user application; a future
  multi-user version would move it into one `dbQuery`.
