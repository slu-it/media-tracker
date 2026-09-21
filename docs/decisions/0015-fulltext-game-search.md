# 0015: Fulltext game search on MariaDB, and Testcontainers MariaDB instead of H2 for every backend test

Status: accepted, 2026-09

## Context

MT-003 adds search-as-you-type over a game's title and description to the paged `GET /api/games` endpoint and an
MCP tool that returns the best matches. Title hits must rank above description hits. The tracked library is small
(a single owner's games), but the search should still be index-backed so that it stays fast as the list grows and
so that the ranking comes from the database instead of application code.

Until now the backend tests ran on H2 in MariaDB mode (decision records 0004, 0011, 0014). H2 accepts none of
MariaDB's fulltext syntax: `FULLTEXT INDEX` fails in `CREATE TABLE`, `ALTER TABLE` and `CREATE ... INDEX`, and
`MATCH ... AGAINST` is "function not found". The first version of this change kept H2 and worked around it with
vendor-specific Flyway folders (`common`, `mariadb`, `h2`; Flyway 13 has no `{vendor}` placeholder), same-named
plain stand-in indexes on H2 and one extra test class on a Testcontainers MariaDB. That doubled the test setup
and left every future feature with the question "which of the two databases tests this".

## Decision

- **MariaDB FULLTEXT in BOOLEAN MODE.** Two InnoDB indexes, `ft_games_title` on `title` and `ft_games_description`
  on `description` (V005), separate so that the two relevances can be weighted: the score is
  `2 * MATCH(title) AGAINST(q) + 0.75 * MATCH(description) AGAINST(q)`. Results are ordered by "has a title hit"
  first, then by score descending, then title, then id; `totalItems` counts every row where either `MATCH` is
  non-zero. The title-hit tier exists because InnoDB relevance alone does not honour the weights (see
  Consequences); within a tier the weighted score ranks. The plain listing (no term)
  orders by title, then id, backed by the B-tree index `idx_games_title (title, id)` (V004). The id is a UUID and
  carries no meaning as a sort key; it is there only so that equal titles (or equal scores and titles) page
  deterministically, and the index covers exactly that order.
- **Query text.** Each whitespace-separated word of the user's term becomes a prefix term (`zel*` finds "Zelda"), joined
  with spaces, i.e. any word may match (OR) and more matching words rank higher. Boolean-mode operators
  (`+ - < > ( ) ~ * " @`) are replaced by spaces before that, so a user cannot exclude or phrase-search and a hyphenated
  title still matches word by word. A term that leaves no words behaves like no term. The term itself is the domain
  value `SearchTerm` (trimmed, non-blank, at most 200 characters, `common/domain`); the boolean-mode rendering is
  MariaDB syntax and lives in `games/persistence/FulltextQuery.kt`, the `MATCH ... AGAINST` predicate and the
  weighted score are Exposed expressions in `games/persistence/FulltextExpressions.kt`. The query text is always a
  bound parameter.
- **Testcontainers MariaDB replaces H2 for every backend test that touches a database.** One `mariadb:11.8`
  container per test JVM (started lazily, removed by Testcontainers' reaper; no container reuse across runs, so a
  changed migration never meets a stale `flyway_schema_history`), one database `media_tracker_test`
  migrated once by the real `DatabaseFactory.connect`. `withFreshDatabase {}` truncates every table in `allTables`
  except the migration-seeded `game_platforms` instead of creating a schema per test; smoke tests boot `module()`
  against the same database (`TestApp` merges the container coordinates into `application-test.yaml`, and upserts
  its user because every class now shares one `users` table). Exposed's implicit default database is pinned to the
  shared test pool, so the pools that `module()` opens and closes per smoke test cannot shift it out from under
  repository tests (the statement-counting tests compare `Database` identity). Consequence: every implicit
  `transaction {}` / `dbQuery {}` inside a smoke test runs on the shared pool, not on the pool `module()` opened from
  the merged config; the module's Hikari settings are exercised by the end-to-end script, not by the smoke tests. Docker (or a compatible container runtime) is therefore
  a development requirement; without it the backend tests fail with one clear message, they are never skipped.
  Consequently there are no vendor-specific migration folders, no H2 stand-in indexes, no `MODE=MariaDB` quirks and
  no `database.migration.timestampType`: the `${timestamp_type}` placeholder in V001 stays (applied scripts are
  never edited) and always resolves to `DATETIME(6)`; new scripts write `DATETIME(6)` directly. This supersedes
  "CI stays database-free" in decision record 0014 and the H2 statements in records 0004 and 0011.
- **`idx_games_title` covers `(title, id)`, not `(title)`.** Exposed's drift check drops one of two indexes over the
  identical column list, and `ft_games_title` already covers `(title)`. InnoDB appends the primary key to every
  secondary index anyway, and the composite matches the listing's sort order.
- **REST and MCP.** `GET /api/games?search=<term>` (blank or absent means the plain listing); `search_games`
  (argument `query`) returns the ten best matches without paging, plus the total number of matches, by calling the
  same service method with a page size of ten. The frontend debounces the field by one second and resets to page 1
  when the term changes.

## Consequences

- Accepted fulltext behaviour: InnoDB's `innodb_ft_min_token_size` (3) means words shorter than three characters are
  never indexed (a title "Go" cannot be found), the default stopword list ("the", "of", ...) is not indexed either;
  prefix terms are never dropped as too short, so typing "ze" already matches "Zelda". Fulltext entries become
  visible when the inserting transaction commits (repository calls run in separate transactions, so tests need no
  extra handling). Boolean mode returns a relevance but does not sort by it; the repository orders explicitly.
- InnoDB's relevance is `tf * idf^2` with `idf = log10(N / rows containing the word)`, computed per index. The
  weights 2.0 and 0.75 therefore do not guarantee that a title hit outranks a description hit: a word that appears
  in several titles scores less per title hit than the same word in a single description (measured on MariaDB
  11.8: "hades" in 2 of 4 titles scores 0.09 per title, in 1 of 4 descriptions 0.36; with one "Hades" title both
  score 0.23 and the weights decide). That is why the ordering puts every game with a title hit before the
  description-only matches and lets the weighted score rank inside each group. A word present in every indexed
  row scores 0 everywhere and the order inside a group falls back to title, id.
- A table holding **exactly one row** breaks that formula in MariaDB 11.8. Once the row's hit is served from the
  on-disk index instead of the in-memory FTS cache -- which happens after a server restart -- `MATCH ... AGAINST`
  evaluates to infinity, and any arithmetic on it aborts the query with `ERROR 1690, DOUBLE value is out of
  range`. Two rows are already enough to avoid it, the bare `WHERE MATCH(...)` predicate is unaffected because it
  does no arithmetic, and `OPTIMIZE TABLE`, `FLUSH TABLES` and `ALTER TABLE ... FORCE` do not provoke it -- only a
  restart does. `FulltextExpressions.kt` therefore clamps each relevance with `LEAST(..., RELEVANCE_CAP)` before
  weighting it; measured against a three-row fixture the clamped scores are identical to the unclamped ones, so
  the cap only ever binds on the pathological value. Without it the first game on a fresh installation turns every
  search into an HTTP 500 after the first restart. The regression test in `FulltextExpressionsTest` asserts the
  clamp is in the generated SQL rather than reproducing the fault: the backend tests share one MariaDB per JVM and
  cannot restart it.
- `./gradlew :backend:test` needs Docker and pulls `mariadb:11.8` once; the first start of a test JVM pays the
  container start (a few seconds). GitHub-hosted runners have Docker, the workflows are unchanged.
- The tests now exercise the production engine, collation and DDL; the MariaDB/H2 divergence risk from decision
  record 0011 is gone, and so is the choice between two test databases for a new feature.
- A future media kind copies the pattern: two FULLTEXT indexes in its migration, declared on the table object with
  `indexType = "FULLTEXT"`, searched through its own `MatchesFulltext`/score expressions, tested in its repository
  test like any other query.
