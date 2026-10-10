# Shared pieces of the local scripts (build-and-start-locally.sh, start-dev.sh). Source it, do not run it.
#
# Exports the local runtime environment (must match docker-compose.yml) and provides:
#   step <text>                 print a section header
#   start_mariadb              docker compose up -d --wait mariadb (no-op if already running)
#   ensure_local_user <jar> [user]
#                               create the user (default "slu") or reset its password to LOCAL_PASSWORD,
#                               using CreateUser from the given JAR
#
# Optional environment:
#   PORT                port for the application (default 8080)

LOCAL_USER="slu"
# Local testing only: every local user gets this fixed password, set again on each run.
LOCAL_PASSWORD="password"
JAR="backend/build/libs/media-tracker.jar"

export DB_URL='jdbc:mariadb://127.0.0.1:3306/mediatracker?sslMode=disable&timezone=UTC&preserveInstants=true'
export DB_USER='mediatracker'
export DB_PASSWORD='mediatracker'
# Local-only values; the cookie must not be Secure over plain http.
export SESSION_SECRET='local-dev-only-secret-do-not-use-in-production'
export SESSION_SECURE='false'
export PORT="${PORT:-8080}"

step() { printf '\n==> %s\n' "$*"; }

start_mariadb() {
  step "Database: docker compose up (no-op if already running)"
  docker compose up -d --wait mariadb
}

# With --reset-password CreateUser creates a missing user and resets an existing one, so this always ends with
# the user present and its password set to LOCAL_PASSWORD.
ensure_local_user() {
  local jar="$1" user="${2:-$LOCAL_USER}"
  step "User: ensure '$user' exists with the local password"
  printf '%s\n' "$LOCAL_PASSWORD" | java -cp "$jar" de.sluit.mediatracker.auth.CreateUser "$user" --reset-password
}
