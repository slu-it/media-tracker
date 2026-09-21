# 0018: One central MariaDB on the Pi, shared through a private Docker network

Status: accepted, 2026-09

## Context

Decision record 0014 put the production database on a MariaDB 11.8 at a web host, and decision record 0016 gave
the application two interchangeable deployment paths on the Raspberry Pi. That left the Pi dependent on a remote
machine for every request, and the web host's database is also the reason `application.yaml` keeps a HikariCP
keepalive: idle connections were being killed from the other side.

The Pi is meant to host more than this one application, and each of them needs a database. Running one MariaDB
per application would multiply a fixed per-server cost that is dominated by caches, not by data. The machine has
roughly 8 GB of memory, at least 4 GB of which is already spoken for, so whatever runs has to be sized
deliberately rather than left at defaults tuned for a real server.

Constraints: the database must not be reachable from the LAN; the two existing deployment paths of decision
record 0016 must keep working or be explicitly narrowed; adding a database must not require editing any
application's compose file; and the schema conventions of decision record 0014 (`utf8mb4`,
`utf8mb4_uca1400_ai_ci`, InnoDB) must be what a newly created database gets by default.

## Decision

- **A third compose project, `deploy/database/`, owns the server.** `name: pi-database`, one service `mariadb`
  on `mariadb:11.8`, container `pi-mariadb`, restarting unless stopped, with the image's own
  `healthcheck.sh --connect --innodb_initialized`. It is a sibling of the two projects of decision record 0016,
  not part of either, because its lifecycle is the Pi's and not any one application's.
- **A private Docker network `pi-db` instead of a published port.** The database stack declares
  `networks: {pi-db: {name: pi-db}}` and therefore creates the network under exactly that name, without a
  project prefix; every application joins it with `external: true`. MariaDB publishes no host port at all, so it
  is unreachable from the LAN and from every other process on the Pi. Applications address it as `mariadb`, the
  service name. Access from outside is default-closed but prepared rather than absent: two commented-out
  `ports:` blocks sit in the compose file, `3306:3306` for a direct connection from another machine and
  `127.0.0.1:3306:3306` for the Pi itself, the systemd path or an SSH tunnel. Opening one is uncommenting it
  and recreating the container, which makes it a deliberate, reversible act for the length of a debugging
  session rather than a standing configuration. Nothing else has to change for it: MariaDB leaves
  `bind-address` unset and already listens on every interface inside the container, and the users
  `create-database.sh` creates are `'<name>'@'%'`.
- **`root` is the only administrative account, with `MARIADB_ROOT_HOST=localhost`.** Its password comes from
  `deploy/database/env` (`env_file`), which is the single place credentials are configured. Restricting root to
  the container's unix socket costs nothing, because both scripts administer the server through
  `docker compose exec`, and it means a leaked root password is useless without shell access to the Pi. The
  official image cannot rename `root`, and a second named admin created by an init script would only add a
  moving part that runs on a fresh data directory and never again.
- **`create-database.sh <name> [password]` provisions a tenant in one step**: a database with an explicit
  `utf8mb4` / `utf8mb4_uca1400_ai_ci` clause, a user of the same name with `ALL PRIVILEGES` on that database and
  nothing else, and an early, successful exit when the database already exists. The user's host part is `%`,
  which is required rather than lax: applications connect from a bridge-network address and `skip_name_resolve`
  rules out host names. The password defaults to the database name reversed and can be overridden by a second
  argument. The SQL is piped in on stdin with the identifier in backticks, never interpolated into a `-e`
  string, because backticks inside a double-quoted shell word are command substitution.
- **`backup-database.sh [name]`** dumps one or all databases with `--single-transaction` into a gzipped file
  under `backups/`, writing `.part` first. The Pi is now the backup target; nothing was needed for this while
  the web host held the data.
- **The data directory is a bind mount, `./data`, not a named volume**, so backups, `rsync` and a filesystem
  check see plain files. The container initialises it and chowns it to uid/gid 999.
- **`conf.d/50-tuning.cnf` sizes the server explicitly.** The values that matter are the three caches that each
  default to 128 MB: `innodb_buffer_pool_size = 64M`, `aria_pagecache_buffer_size = 16M` and
  `key_buffer_size = 8M`. Around them: `max_connections = 25` (this application's pool is 3), 8 MB temporary
  tables, per-connection buffers in the hundreds of kilobytes, `skip_name_resolve`, flash-appropriate
  `innodb_flush_neighbors`/`innodb_io_capacity`, and `character-set-server`/`collation-server` so that a
  database created without an explicit clause already matches every Flyway migration.
- **The container limit is 512 MB and the tuning is what keeps the footprint small.** The two are independent:
  MariaDB does not read its cgroup limit the way a JVM reads `-Xmx`, so the limit only decides when the kernel
  kills the server. Measured on this configuration: 111 MiB resident at idle and 131 MiB right after dumping
  every database, against a 512 MB ceiling with room for bursts of temporary tables. (Measured on x86_64; the
  Pi's arm64 will differ a little.) `MALLOC_ARENA_MAX=2` caps glibc's per-core arenas, which otherwise inflate
  resident memory on a multi-core machine.
- **The compose deployment path is the supported one.** `deploy/docker-compose.yml` joins `pi-db` and reads
  `DB_URL=jdbc:mariadb://mariadb:3306/media-tracker?sslMode=disable&timezone=UTC&preserveInstants=true`. The
  systemd unit runs on the host, cannot resolve `mariadb`, and therefore needs the published port and a
  `127.0.0.1` URL; that is documented in `deploy/env.example` and the README rather than shipped.

## Consequences

- `sslMode` drops from `verify-full` to `disable`. Decision record 0014 chose `verify-full` for a connection
  that crossed the internet; this one crosses a Docker bridge on one machine, and the server has no
  certificate. If the database ever moves off the Pi again, that setting has to move back with it.
- The two deployment paths of decision record 0016 are no longer equally supported. Both still work, but the
  systemd path now costs an uncommented port and a different `DB_URL`, and the single shared
  `/etc/media-tracker/env` cannot hold one `DB_URL` that satisfies both.
- Ordering matters in both directions, and both failures are legible: starting an application before the
  database stack fails with "network pi-db declared as external, but could not be found", and bringing the
  database stack down while an application is attached fails with "active endpoints". The documented order is
  database up first, applications down first.
- There is no `depends_on` across compose projects. When the application container starts before MariaDB
  accepts connections, `DatabaseFactory.connect` fails on HikariCP pool initialisation, the JVM exits and
  `restart: unless-stopped` retries with backoff until it succeeds. A wrong URL or password produces exactly
  the same symptom, so the logs are the only way to tell a race from a misconfiguration.
- Every application on `pi-db` can reach every other application's ports, not only MariaDB: a shared network
  buys convenience at the price of lateral reachability between tenants. The database grants are scoped per
  application, the network is not. Give an application its own network in addition to `pi-db` if that matters.
- The prepared LAN port has no TLS behind it: the server holds no certificate, so a direct connection from
  another machine carries credentials and rows in the clear. The SSH tunnel variant avoids that and is the
  better default for anything longer than a quick look.
- The password convention — the database name reversed — is a convention, not a secret: anyone who can read a
  compose file or run `SHOW DATABASES` can derive it. It is acceptable because the server publishes no port and
  each grant is scoped to one database, and `create-database.sh` takes a real password as a second argument for
  the day that stops being true.
- `./data` must live on a filesystem with Unix ownership (ext4, not exFAT and not a network mount) and should
  live on an SSD: several applications writing to an SD card will wear it out. Restoring files into it by hand
  needs `chown -R 999:999`, and a non-empty `data/` without a `data/mysql` inside it makes the entrypoint refuse
  to initialise, which is why no placeholder file is committed there.
- The Pi is now responsible for its own backups. `backup-database.sh` plus a cron line is the whole story;
  copying `backups/` off the machine is not automated.
- `mariadb:11.8` publishes no `linux/arm/v7` image, so the Pi has to run a 64-bit OS. The application image of
  decision record 0016 is arm64 anyway.
- The HikariCP keepalive in `application.yaml` was tuned for a web host that kills idle connections. It is now
  harmless rather than necessary; the values are left alone because nothing argues for changing them.
- Local development is untouched. The repository-root `docker-compose.yml` keeps its own `mediatracker`
  database in `media-tracker-mariadb` on `127.0.0.1:3306`. The Pi's database is called `media-tracker`, which
  differs from the local name; only `DB_URL` sees that difference. Project, container and network names of the
  three stacks do not overlap, so `--remove-orphans` stays safe in all of them. The one collision is the
  optional published port, which a development machine already uses for the local database.

## Alternatives considered

- **MariaDB as a second service inside `deploy/docker-compose.yml`.** Simplest possible, gives `depends_on` and
  a healthcheck condition for free, but it ties the database's lifecycle to one application: `docker compose
  down -v` while cleaning up the app would delete every other application's data, and the second application
  would have to reach into the first one's project.
- **A published `127.0.0.1:3306`, with the app container reaching it through `host.docker.internal` and
  `extra_hosts: host-gateway`.** Works for containers and host processes alike and keeps the systemd path
  symmetric, but it opens the server to every local process and needs a per-application `extra_hosts` entry
  anyway. The port stays available as a commented-out line for exactly the cases that need it.
- **`network_mode: host` for the database.** Removes the bridge hop, but puts MariaDB on every interface of the
  Pi unless it is separately bound, and loses the container's own DNS name.
- **One MariaDB per application.** Perfect isolation, but the fixed per-server cost is the caches, so three
  applications would cost three times the memory to hold the same amount of data.
- **Staying with the database at the web host.** No work at all, but it keeps every request dependent on a
  remote machine and on a connection that is killed when idle.
- **PostgreSQL, or SQLite per application.** Would mean rewriting the migrations, the fulltext search of
  decision record 0015, and the Testcontainers setup, for a benefit that is not memory.
- **Generated passwords by default in `create-database.sh`.** Safer, and the script supports it, but it makes
  provisioning a two-step ritual (create, then copy the one-time output correctly) for a server that is not
  reachable from outside the host. Recorded here so the trade-off is a choice rather than an oversight.
- **A named volume instead of `./data`.** The usual Docker answer and it avoids the uid 999 friction, but it
  hides the data under `/var/lib/docker/volumes` where a backup or a manual repair is harder to reason about.
