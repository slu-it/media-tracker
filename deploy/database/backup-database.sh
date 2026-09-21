#!/usr/bin/env bash
# Dumps one database, or every database, from the central MariaDB into ./backups as gzipped SQL.
# Decision record 0018.
#
#   ./backup-database.sh                  all databases
#   ./backup-database.sh media-tracker    one database
#
# The Pi is the backup target now that the database no longer lives at a web host, so run this from cron:
#   15 3 * * * cd /opt/pi-database && ./backup-database.sh >> /var/log/pi-database-backup.log 2>&1
# and copy ./backups off the machine. Nothing here prunes old dumps; add `find backups -mtime +30 -delete`
# to the same cron line if you want a retention window.
#
# Restore a dump:
#   zcat backups/<file>.sql.gz | sudo docker compose exec -T mariadb \
#     sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot'
# Restore one application from its own `--databases` dump. The all-databases dump is a disaster-recovery
# artefact: replaying it also replays the `mysql` schema and therefore resets the root password and every
# other application's user.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

step() { printf '==> %s\n' "$*"; }
die() { echo "error: $*" >&2; exit 1; }

if (( $# > 1 )); then
    echo "usage: ./backup-database.sh [databaseName]" >&2
    exit 2
fi

if (( $# == 1 )); then
    database="$1"
    [[ "$database" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$ ]] \
        || die "'$database' is not a valid database name"
    dump_args=(--databases "$database")
    name="$database"
else
    dump_args=(--all-databases)
    name="all-databases"
fi

[[ -n "$(docker compose ps --status running --quiet mariadb 2>/dev/null)" ]] \
    || die "the mariadb container is not running; start it with: docker compose up -d --wait"

mkdir -p backups
target="backups/${name}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

step "Dumping $name to $target"
trap 'rm -f "$target.part"' ERR
# --single-transaction keeps InnoDB consistent without locking out the applications. Writing to .part
# first means a dump that fails halfway never looks like a usable backup. The arguments after the `sh -c`
# script land in its "$@", so the database name is never pasted into a shell string.
docker compose exec -T mariadb \
    sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump -uroot --single-transaction --routines --events "$@"' \
    mariadb-dump "${dump_args[@]}" | gzip > "$target.part"
mv "$target.part" "$target"

step "Done: $target ($(du -h "$target" | cut -f1))"
