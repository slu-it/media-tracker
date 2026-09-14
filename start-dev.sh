#!/usr/bin/env bash
# Local development loop with live code updates:
#   1. make sure the MySQL from docker-compose.yml is running
#   2. start the backend from compiled classes with Ktor auto-reload (./gradlew :backend:run -Pmt.dev=true)
#   3. once http://localhost:8080/health answers, start a Gradle continuous build that recompiles the backend
#      on every Kotlin/resource change (./gradlew :backend:classes -t) and the Vite dev server (pnpm dev)
#
# Open http://localhost:5173. Vite serves the React app with hot module replacement and proxies /api, /login,
# /logout and /health to the backend on :8080. The backend picks up recompiled classes on the first request
# after a change ("Changes in application detected" in the [backend] log). Edits to application.yaml or
# build scripts still need a restart of this script. -Pmt.dev=true (backend/build.gradle.kts) turns on Ktor's
# development mode for `run` and skips building/copying the SPA into the backend resources, so :8080 serves
# only the login page and the API.
#
# The local user "slu" is created via the last built fat JAR when one exists; otherwise run
# ./build-and-start-locally.sh once (the MySQL volume keeps the user afterwards).
#
# Optional environment:
#   MT_LOCAL_PASSWORD   password for the local user when it has to be created (otherwise you are prompted)
#   PORT                backend port (default 8080; the Vite proxy target in frontend/vite.config.ts is fixed to 8080)
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=local-env.sh
source ./local-env.sh

VITE_PORT=5173
HEALTH_TIMEOUT_SECONDS=180
GRADLE_FLAGS=(--console=plain -Pmt.dev=true)

start_mysql

step "Tools: node + pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  # Fall back to the copies the Gradle build downloads (frontend/build.gradle.kts, node-gradle plugin).
  shopt -s nullglob
  pnpm_bins=(frontend/.gradle/pnpm/pnpm-v*/bin)
  node_bins=(frontend/.gradle/nodejs/node-v*/bin)
  shopt -u nullglob
  if [[ ${#pnpm_bins[@]} -eq 0 || ${#node_bins[@]} -eq 0 ]]; then
    echo "pnpm not on PATH and no Gradle-managed copy yet; running ./gradlew :frontend:pnpmInstall"
    ./gradlew :frontend:pnpmInstall --console=plain
    shopt -s nullglob
    pnpm_bins=(frontend/.gradle/pnpm/pnpm-v*/bin)
    node_bins=(frontend/.gradle/nodejs/node-v*/bin)
    shopt -u nullglob
  fi
  export PATH="$PWD/${pnpm_bins[-1]}:$PWD/${node_bins[-1]}:$PATH"
fi
echo "pnpm $(pnpm --version) ($(command -v pnpm))"

if [[ -f "$JAR" ]]; then
  ensure_local_user "$JAR"
else
  step "User: skipped ($JAR not built yet)"
  echo "If '$LOCAL_USER' does not exist in the local database yet, run ./build-and-start-locally.sh once."
fi

command -v curl >/dev/null 2>&1 || { echo "error: curl is required for the health check" >&2; exit 1; }

PIDS=()
# Terminates a process and its descendants (the launch() subshell, the Gradle client / pnpm and their children).
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do kill_tree "$child"; done
  kill -TERM "$pid" 2>/dev/null || true
}
cleanup() {
  trap - INT TERM EXIT
  printf '\n==> Stopping backend, compiler and Vite (the database keeps running)\n'
  for pid in "${PIDS[@]}"; do kill_tree "$pid"; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# Runs a command in the background with every output line prefixed by a tag.
launch() {
  local tag="$1"; shift
  ( "$@" 2>&1 | sed -u "s/^/[$tag] /" ) &
  PIDS+=("$!")
}

step "Backend: ./gradlew :backend:run with Ktor development mode (first start compiles, please wait)"
launch backend ./gradlew :backend:run "${GRADLE_FLAGS[@]}"
backend_pid="${PIDS[-1]}"

step "Waiting for http://localhost:$PORT/health"
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
until curl -fsS "http://localhost:$PORT/health" >/dev/null 2>&1; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "error: backend exited before it became healthy" >&2
    exit 1
  fi
  if (( SECONDS >= deadline )); then
    echo "error: backend did not answer on /health within ${HEALTH_TIMEOUT_SECONDS}s" >&2
    exit 1
  fi
  sleep 2
done
echo "Backend is up."

step "Compiler: ./gradlew :backend:classes -t (recompiles on change; the backend reloads on the next request)"
launch compile ./gradlew :backend:classes -t "${GRADLE_FLAGS[@]}"

step "Frontend: pnpm dev"
launch vite bash -c "cd frontend && exec pnpm dev"

printf '\n==> Open http://localhost:%s (Ctrl+C stops everything except the database)\n\n' "$VITE_PORT"
wait
