#!/usr/bin/env bash
# Local end-to-end run (production-like, no live reload; see start-dev.sh for that):
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
# shellcheck source=local-env.sh
source ./local-env.sh

start_mysql

if [[ "${MT_SKIP_BUILD:-0}" == "1" ]]; then
  step "Build skipped (MT_SKIP_BUILD=1)"
  [[ -f "$JAR" ]] || { echo "error: $JAR not found, run without MT_SKIP_BUILD first" >&2; exit 1; }
else
  step "Build: ./gradlew build"
  ./gradlew build
fi

ensure_local_user "$JAR"

step "Start: http://localhost:$PORT (Ctrl+C to stop; the database keeps running)"
exec java -Xmx192m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -jar "$JAR"
