#!/usr/bin/env bash
# Creates a database on the central MariaDB (docker-compose.yml next to this script) together with a user
# that owns it. Decision record 0018.
#
#   ./create-database.sh <databaseName> [password]
#
# The user is named after the database and gets ALL PRIVILEGES on it and on nothing else. Its password
# defaults to the database name reversed: a convention rather than a secret, which is acceptable here
# because the server publishes no port and every grant is scoped to one database. Pass a second argument
# to use a real password instead, e.g. "$(openssl rand -base64 24)". A supplied password must not contain a
# backslash, which MariaDB reads as an escape character under the default sql_mode.
#
# Exits successfully without changing anything if the database already exists. The connection details are
# printed on creation only, so keep them; re-running prints nothing and changes no password.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

step() { printf '==> %s\n' "$*"; }
die() { echo "error: $*" >&2; exit 1; }
usage() { echo "usage: ./create-database.sh <databaseName> [password]" >&2; }

# Runs the SQL on stdin as root inside the container. The password is taken from the container's own
# environment, so it never reaches this host's process list or shell history; MYSQL_PWD is still the
# variable the MariaDB client reads in 11.8.
mariadb_root() {
    docker compose exec -T mariadb \
        sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot --batch --skip-column-names'
}

# Reversed in pure bash, so the script does not depend on `rev` being installed on the Pi.
reverse() {
    local input="$1" output="" i
    for (( i = ${#input} - 1; i >= 0; i-- )); do output+="${input:i:1}"; done
    printf '%s' "$output"
}

if (( $# < 1 || $# > 2 )); then
    usage
    exit 2
fi

database="$1"
# Letters, digits, underscore and hyphen only. Everything downstream (identifiers, the datadir directory
# name, the JDBC URL) is safe for that set, and it keeps unvalidated input out of the SQL below.
if [[ ! "$database" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$ ]]; then
    echo "error: '$database' is not a valid database name (letters, digits, _ and -, at most 64 characters)" >&2
    usage
    exit 2
fi

password="${2:-$(reverse "$database")}"
# A SQL string literal needs doubled single quotes, and under the default sql_mode a backslash is an escape
# character, so that has to be doubled first. The database name is already restricted by the regex above.
password_literal="${password//\\/\\\\}"
password_literal="${password_literal//\'/\'\'}"

[[ -n "$(docker compose ps --status running --quiet mariadb 2>/dev/null)" ]] \
    || die "the mariadb container is not running; start it with: docker compose up -d --wait"

exists_query="SELECT schema_name FROM information_schema.SCHEMATA WHERE schema_name = '$database';"
# Assigned rather than inlined into the test, so that a failing query (wrong root password, container
# restarting) aborts here under `set -e` instead of being read as "the database does not exist".
existing="$(printf '%s\n' "$exists_query" | mariadb_root)"
if [[ -n "$existing" ]]; then
    step "Database $database already exists, nothing to do"
    exit 0
fi

step "Creating database $database and user $database"
# Backticks quote the identifier (a hyphen would otherwise be a minus sign), single quotes the user name.
# The host part must be '%': the application connects from another container, i.e. from a bridge-network
# address, and skip_name_resolve rules out host names. That is safe while the server has no published port.
# GRANT reads its database part as a LIKE pattern even inside backticks, so an unescaped underscore would
# also grant this user everything on `mediaXtracker` when the database is `media_tracker`. Hence the escape.
mariadb_root <<SQL
CREATE DATABASE \`$database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;
CREATE USER IF NOT EXISTS '$database'@'%' IDENTIFIED BY '$password_literal';
ALTER USER '$database'@'%' IDENTIFIED BY '$password_literal';
GRANT ALL PRIVILEGES ON \`${database//_/\\_}\`.* TO '$database'@'%';
SQL

cat <<INFO

Put these into the application's environment file (see deploy/env.example):

DB_URL=jdbc:mariadb://mariadb:3306/$database?sslMode=disable&timezone=UTC&preserveInstants=true
DB_USER=$database
DB_PASSWORD=$password

The application's container has to join the pi-db network; deploy/docker-compose.yml shows how.
INFO
