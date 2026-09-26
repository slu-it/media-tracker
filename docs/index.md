# Documentation index

Start here for anything `CLAUDE.md` does not answer. `CLAUDE.md` holds only the commands and the rules that hold
for every task. The conventions of one layer live in `.claude/rules/` and load when files of that layer are
touched. Everything about a feature lives on its page under `docs/features/`, every decision of weight is an
ADR under `docs/decisions/`. A new ticket adds a row to the features table and a feature page (plus an ADR when
a decision was taken), never prose in `CLAUDE.md` ([ADR 0025](decisions/0025-agent-instruction-layout.md)).

## Features

| Feature | Tickets | Summary | Details | ADRs |
|---|---|---|---|---|
| Games | MT-001 | The one implemented media kind and the template for the others: title, year, optional description, cover URL and quarter-step rating, many-to-many platforms from a seeded table; grid, dialogs, 36 per page. | [games.md](features/games.md) | 0007, 0009 |
| Books, Movies, Series | - | "Coming soon" tabs in `frontend/src/features/{books,movies,series}/`; copy the games package and dialogs to implement one. | [games.md](features/games.md) | 0007, 0010 |
| API keys and MCP server | MT-002 | Two per-user API keys (settings dialog) open `POST /mcp`, a stateless MCP server whose tools each feature contributes. | [api-keys-and-mcp.md](features/api-keys-and-mcp.md) | 0013 |
| Game search and filters | MT-003, MT-011 to MT-015 | Fulltext search over title and description, four filters fed by `GET /api/games.meta`, agent-only `hasMissing` filter and `pageSize` on `search_games`. | [game-search-and-filters.md](features/game-search-and-filters.md) | 0015, 0021, 0022 |
| Game status fields | MT-007 | `ownership`, `progress` and `hidden` as Kotlin enums on the game, shown as icons, ignored by search and paging. | [game-status-fields.md](features/game-status-fields.md) | 0017 |
| Theme mode toggle | MT-010 | Light/dark toggle in the header, stored per browser under `mt.mode`, honoured by the login page too. | [theme-mode.md](features/theme-mode.md) | 0020 |
| Game expansions | MT-016 | DLC as a nested sub-resource with an owner-arranged dense sequence; drag-sortable stack in the detail dialog; `list_expansions`/`add_expansion` MCP tools. | [game-expansions.md](features/game-expansions.md) | 0023 |
| Cover picker | MT-017 | Click the cover in the detail dialog to pick a SteamGridDB grid through a backend adapter; `STEAMGRIDDB_API_KEY` is optional; `find_game_cover` MCP tool. | [cover-picker.md](features/cover-picker.md) | 0024 |
| Title suggestions | MT-019 | SteamGridDB matches suggested while typing a title in the add/edit form; a pick also sets the year; empty without a key or on failure. | [title-suggestions.md](features/title-suggestions.md) | 0026 |
| Export / Import | MT-023 | JSON dump of every domain table (settings tab) and an insert-if-absent import; each domain contributes its tables through `BackupSource`. | [export-import.md](features/export-import.md) | 0027 |
| Dropbox backup | MT-024 | Connect Dropbox in the Export / Import tab by pasting a code; the export goes daily at 03:00 (and on demand) to `backup/full-export.json` in the App folder; last backup read from Dropbox. | [dropbox-backup.md](features/dropbox-backup.md) | 0028 |

## Decisions

Numbers are claimed on branches before they are merged, so find the next free one across every git ref, not only
the checked-out directory:
`git for-each-ref --format='%(refname)' | xargs -I{} git ls-tree -r --name-only {} -- docs/decisions | sort -u`.

| ADR | Title | Decision |
|---|---|---|
| [0001](decisions/0001-ktor.md) | Ktor as the server framework | Ktor 3.5 (CIO) with kotlinx.serialization, Exposed and HikariCP for fast startup on the Pi. |
| [0002](decisions/0002-single-jar.md) | One fat JAR serves API, login page and SPA | Gradle builds one deployable JAR holding the server, the login HTML and the compiled React app. |
| [0003](decisions/0003-pnpm.md) | pnpm, driven by Gradle | Node 24 and pnpm 10 are downloaded by node-gradle; Gradle tasks wrap the npm scripts; versions pinned exactly. |
| [0004](decisions/0004-exposed-1x-and-schema.md) | Exposed 1.5 for queries, Flyway for the schema | Flyway SQL is the schema's source of truth, Kotlin table objects mirror it, a drift test keeps both aligned. |
| [0005](decisions/0005-linting.md) | ktlint, ESLint + Prettier; detekt deferred | ktlint 1.8 `intellij_idea` style with `no-unused-imports`; ESLint flat config + Prettier; detekt waits for Kotlin 2.4 support. |
| [0006](decisions/0006-local-dev-loop.md) | Local dev loop with Ktor auto-reload and the Vite dev server | `start-dev.sh` runs Ktor in development mode with a continuous build next to `pnpm dev`; `-Pmt.dev=true` skips the SPA copy. |
| [0007](decisions/0007-layered-domain-modules.md) | Feature-first backend modules with onion layers and self-validating value classes | `<feature>.{api,domain,persistence}` with inward dependencies; value classes validate in `init`; only domain types cross layers. |
| [0008](decisions/0008-frontend-ui-stack.md) | MUI with Emotion, i18next for translations | MUI 9 + Emotion, i18next with typed keys from inline JSON bundles, system fonts. |
| [0009](decisions/0009-game-platforms-as-reference-data.md) | Game platforms as a seeded reference table, not an enum | Platforms are rows in `game_platforms` (fixed UUIDs, hex colours), many-to-many via `game_to_platform`, read-only API. |
| [0010](decisions/0010-domain-first-packages.md) | Domain-first top-level packages | Top-level packages are domains (business and technical); `common` is an onion module too; the package root is the composition root. |
| [0011](decisions/0011-backend-test-strategy.md) | Backend test strategy | Six test levels, mocks only above the repository interfaces, one behaviour per method, coverage as information. |
| [0012](decisions/0012-frontend-test-conventions.md) | Frontend test conventions | Behaviour through the accessibility tree, `fetch` as the only mock boundary, `console.error` fails the test, no `data-testid`. |
| [0013](decisions/0013-api-keys-and-mcp-server.md) | Per-user API keys and a stateless MCP server behind them | Two plaintext UUID keys per user; `POST /mcp` speaks stateless Streamable HTTP behind `X-API-Key` or `Authorization: Bearer`. |
| [0014](decisions/0014-mariadb.md) | MariaDB 11.8 instead of MySQL 8, three-digit migration versions | MariaDB Connector/J, `utf8mb4_uca1400_ai_ci`, `V<nnn>__` migration names. |
| [0015](decisions/0015-fulltext-game-search.md) | Fulltext game search, Testcontainers MariaDB instead of H2 | MariaDB FULLTEXT with a weighted score; every backend test runs on one Testcontainers `mariadb:11.8` per JVM. |
| [0016](decisions/0016-container-image.md) | Container image on distroless Java, published to GHCR | One `COPY` onto `gcr.io/distroless/java25-debian13:nonroot`, JVM flags in `JAVA_TOOL_OPTIONS`, multi-arch push from `master.yml` only; docker compose as second deployment path. |
| [0017](decisions/0017-game-status-fields.md) | Ownership, progress and hidden as code enums | Closed sets are Kotlin enums with a `wire` value stored in `VARCHAR(32)`; the domain owns the defaults; extensible vocabulary stays a seeded table. |
| [0018](decisions/0018-central-database-on-the-pi.md) | One central MariaDB on the Pi, shared through a private Docker network | `deploy/database/` owns MariaDB on the `pi-db` network without a host port; applications join it as external. |
| 0019 | Caddy terminates TLS in front of the application, with its own local CA | On branch `feat/https`, not merged yet; the number is taken. |
| [0020](decisions/0020-theme-mode-toggle.md) | A light/dark toggle in the header, stored per browser | Two states, MUI owns the state, localStorage key `mt.mode`, the login page reads the same key. |
| [0021](decisions/0021-filterable-game-list.md) | Filtering the game list, and `.meta` endpoints | Four filters OR within and AND across; `.meta` returns the values that occur; platform filter as a semi-join. |
| [0022](decisions/0022-missing-data-filter-and-mcp-page-size.md) | A `hasMissing` filter and a page size for `search_games` | Agent-only `hasMissing` category over `IS NULL` checks; `pageSize` default 10, maximum 100. |
| [0023](decisions/0023-game-expansions.md) | Game expansions as a nested sub-resource, with an owner-defined order | Second aggregate of the games domain under `/api/games/{id}/expansions`; the service owns a dense zero-based sequence. |
| [0024](decisions/0024-cover-picker-steamgriddb.md) | Cover image picker backed by SteamGridDB, through a backend adapter | `GET /api/games/cover-options` behind a `CoverSource` port; key optional; URLs stay external. |
| [0025](decisions/0025-agent-instruction-layout.md) | Layout of agent instructions and documentation | Short `CLAUDE.md`, this index as lazy entry point, feature pages, path-scoped rules, role-only agents. |
| [0026](decisions/0026-title-suggestions-degrade-to-empty.md) | Title suggestions from SteamGridDB degrade to an empty list | `GET /api/games/title-suggestions` returns `[]` when the source is unconfigured or failing, unlike the picker's 503/502. |
| [0027](decisions/0027-json-backup-per-domain-sources.md) | JSON export and import as a column-level dump contributed by each domain | `BackupSource` per domain over a generic Exposed implementation; import inserts rows whose primary key is absent, one transaction per source. |
| [0028](decisions/0028-dropbox-backup.md) | Daily backup to Dropbox, connected from the settings dialog | No-redirect OAuth code flow, refresh token in `oauth_connections`, `CloudStorage` port, application-scope scheduler at a fixed time with one retry, status read from Dropbox. |

## Other documents

- [README.md](../README.md): prerequisites, everyday commands, first user, MCP client setup, local end-to-end run,
  dev loop, CI, Pi deployment and the shared database.
- [architecture.md](architecture.md): request flow, sessions, API keys and MCP, backend and frontend module maps,
  API table, build pipeline, runtime on the Pi, schema migration rules, developer loop.
