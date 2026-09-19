# 0014: MariaDB 11.8 instead of MySQL 8, three-digit migration versions

Status: accepted, 2026-09

## Context

Phase 1 and MT-001/MT-002 were written against MySQL 8 (ADR 0004): MySQL Connector/J, `mysql:8.4` in Docker, and
`utf8mb4_0900_ai_ci` on every table. The web host that will serve the production database offers MariaDB 11.8, not
MySQL. Nothing is live yet, no database outside throwaway Docker volumes has ever run the migrations, so the switch
can be made by editing the existing scripts rather than by adding new ones.

MariaDB speaks the MySQL wire protocol and its SQL dialect is close enough that the Kotlin code (Exposed has an
explicit MariaDB dialect; production DDL comes from Flyway with our `DATETIME(6)` placeholder, and column types are
only compared on H2, so it does not matter that Exposed's MariaDB dialect would emit `TIMESTAMP(6)`), Flyway
(`flyway-mysql` contains the MariaDB database type) and the schema (`AUTO_INCREMENT`, `ENGINE=InnoDB`, `CHAR(36)`
ids, `DOUBLE`, `TEXT`, cascading foreign keys, `UNIQUE` over nullable columns) carry over unchanged. Two things do
not:

- `utf8mb4_0900_ai_ci` is a MySQL 8 collation. MariaDB accepts the name only as an alias in point releases from
  2025 onward, and its own UCA collation family is named differently; relying on the alias would tie the scripts to
  a minimum MariaDB patch level for no benefit.
- MySQL Connector/J connects to MariaDB, but it assumes MySQL server semantics and version numbers; the vendor's
  own driver is the supported path, and its JDBC URL parameters are spelled differently.

## Decision

- **MariaDB 11.8 is the production database.** Local development and the end-to-end script use the official
  `mariadb:11.8` image (`docker-compose.yml`, service `mariadb`, health check `healthcheck.sh --connect
  --innodb_initialized`). CI stays database-free (H2), as before. (Superseded by decision record 0015: every backend
  test runs against a Testcontainers MariaDB, in CI as well.)
- **MariaDB Connector/J** (`org.mariadb.jdbc:mariadb-java-client` 3.5.10, LGPL 2.1) replaces MySQL Connector/J. URLs
  start with `jdbc:mariadb://`; the parameters we use are `sslMode=disable|trust|verify-full` (lower case),
  `timezone=UTC` (the driver's shorthand for `connectionTimeZone=UTC` plus forcing it onto the session) and
  `preserveInstants=true`. The last one matters: MariaDB Connector/J defaults it to `false` and then binds
  `java.sql.Timestamp` values, which is what Exposed's `timestamp()` sends, in the JVM's default zone, so a Pi
  running on local time would store local wall-clock values in a UTC session (self-consistent, but not UTC and
  ambiguous during the DST fall-back hour). MySQL Connector/J's `allowPublicKeyRetrieval` is gone; it served
  `caching_sha2_password`, which MariaDB does not use. `flyway-core` + `flyway-mysql` stay; Flyway picks the MariaDB
  database type from the URL prefix.
- **Collation `utf8mb4_uca1400_ai_ci`** on every table. It is MariaDB's current UCA (14.0.0) accent- and
  case-insensitive collation and the closest counterpart to MySQL's `utf8mb4_0900_ai_ci`. H2 ignores collation
  clauses, so the tests do not see the change.
- **Migration files are `V<nnn>__<snake_case>.sql`** with a zero-padded three-digit version (`V001`, `V002`, ...),
  so they sort correctly in file listings for the lifetime of the project. Flyway compares versions numerically, so
  `V001` is version 1; the padding is cosmetic. The three existing scripts were renamed and, for the collation and
  the header comments, edited in place. This is the second and last such amendment (the first is ADR 0009): from
  the first deployment on, applied scripts are immutable and every change is a new `V<nnn+1>`.
- **Tests run H2 in MariaDB compatibility mode** (superseded by decision record 0015, Testcontainers MariaDB) (`MODE=MariaDB;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE`)
  instead of `MODE=MySQL`; Exposed's H2 dialect knows both. The drift test passes unchanged, and Flyway now records
  the versions as `001`, `002`, `003` in `flyway_schema_history` (the test that checks the history was adjusted).

## Consequences

- Everything that named MySQL now names MariaDB: README, `docs/architecture.md`, `CLAUDE.md`, the agent
  definitions, `deploy/env.example`, `local-env.sh`, the compose file and the migration headers. ADR 0004 remains
  the record for Exposed and Flyway; its driver note is superseded by this record.
- Anyone with a local Docker setup from the MySQL era must run `docker compose down -v --remove-orphans` once: the
  service and volume names changed, so a plain `down -v` would leave the old container holding port 3306, and a
  MySQL data directory cannot be opened by MariaDB anyway.
- Should the host ever move again (MySQL 8, or a newer MariaDB), the collation clause is the one line per table to
  revisit; everything else is dialect-neutral.

## Alternatives considered

- **Keep MySQL Connector/J and `jdbc:mysql://`.** Works against MariaDB today and would have been a zero-code
  change, but it is the unsupported combination from both vendors' point of view and hides behind a driver that
  treats "11.8.x-MariaDB" as a MySQL version string.
- **Drop the `COLLATE` clause and inherit the server default.** MariaDB 11.8's default for `utf8mb4` is already
  `utf8mb4_uca1400_ai_ci`, but shared hosts can configure a different server default; an explicit clause keeps
  ordering and uniqueness semantics identical everywhere.
- **`utf8mb4_unicode_ci`** (UCA 4.0.0). Portable to MySQL as well, but an older Unicode Collation Algorithm for no
  gain; portability to MySQL is not a goal anymore.
- **A Flyway placeholder for the collation**, like `${timestamp_type}`. Would let the same scripts run on MySQL
  again, but adds a per-environment knob for a hypothetical move; a one-line edit per table is cheaper if it ever
  happens.
- **Add a `V004` that converts the collation instead of editing `V001`/`V002`.** Pointless: `V001` would still
  fail on a MariaDB that lacks the `utf8mb4_0900_ai_ci` alias before `V004` could run.
