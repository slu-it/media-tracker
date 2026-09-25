---
paths:
  - "backend/src/main/resources/db/migration/**"
  - "backend/src/main/kotlin/**/persistence/*Table.kt"
  - "backend/src/main/kotlin/de/sluit/mediatracker/Schema.kt"
---
# Schema changes are a two-file commit

Flyway SQL in `backend/src/main/resources/db/migration/` is the source of truth; an Exposed table object mirrors
it (`<feature>/persistence/*Table.kt`) and must be listed in `allTables` in `Schema.kt` (package root). A new domain table also goes into its domain's
`BackupSource` in `backupSources` (or `BackupCoverageTest` fails; ADR 0027).
`SchemaDriftTest` compares the migrated test MariaDB with the Kotlin tables and fails if Exposed would still
want to change anything (ADR 0004, 0014).

- Name scripts `V<nnn>__<snake_case>.sql`; never edit an applied script, add `V<nnn+1>`.
- SQL targets MariaDB 11.8 only (the tests run the same engine, ADR 0015). Timestamp columns are `DATETIME(6)`;
  the `${timestamp_type}` placeholder in V001 is a leftover from the H2 era and always resolves to `DATETIME(6)`.
- UUID ids are `CHAR(36)` text (Exposed `char("id", 36)`), never `uuid()`.
- Every FK column gets an explicit `INDEX` in SQL and `.index()` in Kotlin, or the drift test fails.
- Declare every index on the table object (`index(name, false, cols, indexType = "FULLTEXT")` for fulltext).
  Exposed compares indexes by name, columns and uniqueness and treats two indexes over the identical column
  list as excess, hence `idx_games_title (title, id)` next to the fulltext `ft_games_title (title)`.
- A new column with a default is added as `NOT NULL DEFAULT <x>` to backfill existing rows, then the default is
  dropped again (`ALTER TABLE t ALTER COLUMN c DROP DEFAULT`), and the Exposed column declares no `.default()`:
  the drift test compares defaults in both directions and the domain owns them (ADR 0017). Raw Exposed inserts
  in tests must therefore write every column.
- Closed value sets are Kotlin enums stored as `VARCHAR(32)` wire values, never SQL `ENUM`; extensible
  vocabulary is a seeded reference table like `game_platforms` (ADR 0009, 0017).
- Sequences owned by a service (like `game_expansions.sequence`) get no `UNIQUE` constraint when a move rewrites
  several rows in one transaction (ADR 0023).
- Migrations run at startup; the app never alters the schema itself.
