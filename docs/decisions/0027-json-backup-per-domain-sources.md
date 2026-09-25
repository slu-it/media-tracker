# 0027: JSON export and import as a column-level dump contributed by each domain

Status: accepted, 2026-09

## Context

The tracker needs backups. The first step is a manual JSON export that can be downloaded from the settings
dialog and imported again. A daily upload to Dropbox will follow and reuse the same export. The dump has to cover
every domain table (today the four games tables, later books, movies and series) and exclude the system tables
`users` and `sessions`. The most likely import target is an empty database being restored. Every domain row has
a UUID primary key, so collisions are technically possible but unlikely.

A central backup package that imports every domain's Exposed tables would couple it to each domain's
persistence, and every new media kind would have to remember to register there.

## Decision

- **The format is a column-level dump.** The root object has one property per table (the DB table name). Each
  property is an array of row objects keyed by DB column name, with JSON-typed values (string, number, boolean,
  `null`). Tables appear in insert order, parents first.
- **Each domain contributes its tables through `BackupSource`** (`common/domain/BackupSource.kt`). The interface
  deals only in plain Kotlin maps (`BackupRow = Map<String, Any?>`), so the domain stays free of Exposed and
  kotlinx. The generic `ExposedBackupSource(tables)` in `common/persistence` implements it for any list of
  Exposed tables. A domain's source is one line: `GamesBackupSource` in `games/persistence`.
- **`backupSources` in `Schema.kt` is the single registry**, next to `allTables`. `BackupCoverageTest` fails
  when a table in `allTables` is neither covered by exactly one source nor on the system list (`users`,
  `sessions`).
- **The `backup` package** (`BackupService`, `BackupRoutes`) only knows the interface. It merges exports,
  rejects unknown table names before any write and hands each source its slice. JSON ↔ row conversion lives in
  `backup/api`.
- **Import is insert-if-absent by primary key.** Existing PK tuples are read first and only missing rows are
  inserted, so re-importing the same file is a no-op and the seeded platforms are skipped. `INSERT IGNORE` is
  not used, because MariaDB would turn FK violations into silent warnings.
- **Validate everything, then write, one transaction per source.** Every source validates its slice before any
  source writes: unknown or missing column, uncoercible value, over-long string, duplicate primary key inside
  the file. Primary keys are compared lowercased and trimmed, as the `_ci` collation does. An integrity
  violation during the inserts (SQLSTATE `23xxx`, e.g. a unique `label` clash or a dangling FK) rolls back that
  source. Each of these is a `400 validation_error` naming the table or `table.column`, without driver details.
  Other SQL failures stay a 500.
- **Domain value-class rules are not re-checked on import.** The import restores the tracker's own dumps; only
  column types and DB constraints apply.

## Alternatives not taken

- **Export through the domain services and DTOs**: every media kind would need its own export and import
  mapping, and the dump would no longer match the schema one to one.
- **Overwrite on collision (upsert)**: an import could silently revert newer edits. Insert-if-absent never
  destroys data, which is also why the UI asks for no confirmation.
- **Multipart upload**: the file is posted as the raw JSON body. It is small, and plain JSON keeps the endpoint
  usable with `curl`.

## Consequences

- There is no format version yet. A future `NOT NULL` column without a default makes older dumps fail with
  "missing column" until the import learns a default for it. That is the moment to add a version.
- `ExposedBackupSource` coerces only the column types in use today (char, varchar, text, integer, double,
  boolean). A new column type, such as a timestamp, needs one more branch. `BackupCoverageTest` fails until it
  has one, and at runtime an unrecognised type is a server error, never a silent mis-coercion.
- Atomicity is per source, not across sources. That is enough while no FK crosses domains.
- Insert-if-absent works row by row. Importing into a non-empty database can therefore break invariants that
  span rows. For example, expansions of a game that exists in both places are added next to the existing ones,
  and `sequence` can end up duplicated or with gaps (ADR 0023). Restoring into an empty database, the intended
  case, is unaffected.
- The request body has no size limit of its own. The endpoint is session-authenticated, and a dump of a
  personal collection is small.
- Step 2 (daily Dropbox upload) calls the same `BackupService.export()`.
