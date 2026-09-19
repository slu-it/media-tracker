# 0004: Exposed 1.5 for queries, Flyway for the schema

Status: accepted, 2026-09 (revised the same month: Flyway replaces startup `SchemaUtils.create`; the database
engine, driver, collation and migration file naming were changed by ADR 0014, which supersedes the notes below
where they conflict; read "MySQL" and "H2 in MySQL mode" below as MariaDB 11.8 and H2 in MariaDB mode)

## Context

The project description asked for "Exposed 1.0.x, latest patch". By September 2026 the 1.x line has reached
1.5.0 and only 1.0.0 exists in the 1.0.x series; Exposed promises no breaking changes within 1.x.

The first scaffold created tables at startup with `SchemaUtils.create`, which can add tables but never evolve
columns. We want versioned, explicit SQL from the start, applied automatically when the application boots.

## Decision

- **Exposed 1.5.0** (`exposed-core`, `exposed-jdbc`, `exposed-kotlin-datetime`) for queries. Package roots are
  `org.jetbrains.exposed.v1.core`, `...v1.jdbc`, `...v1.datetime`; timestamp columns are `kotlin.time.Instant`.
- **Flyway 13.x** (`flyway-core` + `flyway-mysql`, Apache 2.0) runs versioned SQL from
  `backend/src/main/resources/db/migration` inside `DatabaseFactory.connect`, before Exposed is bound to the pool.
  The SQL scripts are the source of truth for the schema; the Kotlin `Table` objects mirror them.
- **Drift guard.** `exposed-migration-jdbc`'s `MigrationUtils.statementsRequiredForDatabaseMigration` is used in
  two read-only places: `SchemaDriftTest` migrates a fresh H2 database and asserts the diff is empty, and
  `DatabaseFactory` logs a warning at startup if the live schema and the Kotlin model disagree. Nothing is ever
  applied by Exposed.
- **No baseline logic.** A database that has tables but no `flyway_schema_history` makes Flyway fail with a clear
  error. Only pre-Flyway local databases can be in that state; they are reset once with `docker compose down -v`.
- Tests run against H2 2.5 in MySQL compatibility mode
  (`MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE`).

## Why Flyway rather than Exposed's migration module

`exposed-migration-jdbc` is a schema diff generator, not a migration runner: it compares Kotlin tables with the
live database and produces the CREATE/ALTER/DROP statements (including destructive ones) needed to align them.
It has no history table, no ordering, no checksum validation and no "apply pending scripts" step; all of that
would have to be written and owned here. Flyway provides exactly those pieces, with plain SQL files reviewed in
git, and the diff generator is still valuable as a test oracle. The combination gives explicit SQL as the source
of truth plus a mechanical check that the Kotlin model matches it.

## Consequences and rules

- Scripts are named `V<nnn>__<snake_case>.sql` (strict naming validation is on; nothing else may live in the
  folder). A script is never edited once it has been applied anywhere; add a new version instead.
- Scripts must run on MySQL 8.x and on H2 in MySQL mode. H2 accepts and ignores `ENGINE=` and charset/collation
  clauses; inline `INDEX name (col)` and `CONSTRAINT ... FOREIGN KEY` work on both.
- Exposed maps `timestamp()` to `DATETIME(6)` on MySQL but to `TIMESTAMP(9)` on H2 (its H2 dialect does not
  delegate types in MySQL mode), and H2 rejects `DATETIME(9)`. Column types are only compared on H2. Scripts
  therefore write `${timestamp_type}`, a Flyway placeholder set from `database.migration.timestampType`
  (`DATETIME(6)` in `application.yaml`, `TIMESTAMP(9)` in `application-test.yaml`).
- Foreign-key columns get an explicit index in both SQL and Kotlin (`.index()`). H2 creates one implicitly and
  Exposed only ignores implicit FK indexes on the real MySQL dialect, so without the explicit index the drift check
  would report a `DROP INDEX` on H2.
- Index and constraint names do not influence the drift check (it matches by columns), but we keep Exposed's
  naming (`<table>_<column>[_unique]`, `fk_<table>_<column>__<target>`) for readability.
- Every schema change is one PR touching `db/migration/V<nnn>__*.sql` and `db/Tables.kt` together; the drift test
  fails otherwise.

## Notes

- The driver was MySQL Connector/J 26.7.0 until ADR 0014 replaced it with MariaDB Connector/J. Flyway detects the
  database type by JDBC URL prefix, so the driver version is irrelevant to it.
- Passkeys (`com.yubico:webauthn-server-core`) are not part of phase 1; a future `credentials` table is simply
  the next migration.
