#!/usr/bin/env bash
# Local development loop:
#   1. make sure the MySQL from docker-compose.yml is running (starts it if needed, waits until healthy)
#   2. build the whole project (frontend + backend, tests, fat JAR)
#   3. make sure the local user "slu" exists (prompts for a password only when the user is missing)
#   4. start the application on http://localhost:8080
#
# Optional environment:
#   MT_LOCAL_PASSWORD   password for the local user when it has to be created (otherwise you are prompted)
#   MT_SKIP_BUILD=1     skip step 2 and start the last built JAR
#   PORT                port for the application (default 8080)
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

LOCAL_USER="slu"
JAR="backend/build/libs/media-tracker.jar"

# Must match docker-compose.yml.
export DB_URL='jdbc:mysql://127.0.0.1:3306/mediatracker?sslMode=DISABLED&allowPublicKeyRetrieval=true&connectionTimeZone=UTC'
export DB_USER='mediatracker'
export DB_PASSWORD='mediatracker'
# Local-only values; the cookie must not be Secure over plain http.
export SESSION_SECRET='local-dev-only-secret-do-not-use-in-production'
export SESSION_SECURE='false'
export PORT="${PORT:-8080}"

step() { printf '\n==> %s\n' "$*"; }

step "Database: docker compose up (no-op if already running)"
docker compose up -d --wait mysql

if [[ "${MT_SKIP_BUILD:-0}" == "1" ]]; then
  step "Build skipped (MT_SKIP_BUILD=1)"
  [[ -f "$JAR" ]] || { echo "error: $JAR not found, run without MT_SKIP_BUILD first" >&2; exit 1; }
else
  step "Build: ./gradlew build"
  ./gradlew build
fi

step "User: ensure '$LOCAL_USER' exists"
# CreateUser exits 1 with "already exists" when the user is present; that is fine here, anything else is not.
create_user_stderr="$(mktemp)"
trap 'rm -f "$create_user_stderr"' EXIT
set +e
if [[ -n "${MT_LOCAL_PASSWORD:-}" ]]; then
  printf '%s\n' "$MT_LOCAL_PASSWORD" | java -cp "$JAR" de.sluit.mediatracker.auth.CreateUser "$LOCAL_USER" 2> >(tee "$create_user_stderr" >&2)
else
  java -cp "$JAR" de.sluit.mediatracker.auth.CreateUser "$LOCAL_USER" 2> >(tee "$create_user_stderr" >&2)
fi
create_user_exit=$?
set -e
if [[ $create_user_exit -ne 0 ]]; then
  if grep -q "already exists" "$create_user_stderr"; then
    echo "User '$LOCAL_USER' already exists, moving on."
  else
    echo "error: creating user '$LOCAL_USER' failed (exit $create_user_exit)" >&2
    exit "$create_user_exit"
  fi
fi

step "Start: http://localhost:$PORT (Ctrl+C to stop; the database keeps running)"
exec java -Xmx192m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -jar "$JAR"
