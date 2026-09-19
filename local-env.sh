# Shared pieces of the local scripts (build-and-start-locally.sh, start-dev.sh). Source it, do not run it.
#
# Exports the local runtime environment (must match docker-compose.yml) and provides:
#   step <text>                 print a section header
#   start_mariadb              docker compose up -d --wait mariadb (no-op if already running)
#   ensure_local_user <jar>     make sure the local user exists, using CreateUser from the given JAR
#
# Optional environment:
#   MT_LOCAL_PASSWORD   password for the local user when it has to be created (otherwise you are prompted)
#   PORT                port for the application (default 8080)

LOCAL_USER="slu"
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

# CreateUser exits 1 with "already exists" when the user is present; that is fine here, anything else is not.
ensure_local_user() {
  local jar="$1"
  step "User: ensure '$LOCAL_USER' exists"
  local create_user_stderr create_user_exit
  create_user_stderr="$(mktemp)"
  set +e
  if [[ -n "${MT_LOCAL_PASSWORD:-}" ]]; then
    printf '%s\n' "$MT_LOCAL_PASSWORD" | java -cp "$jar" de.sluit.mediatracker.auth.CreateUser "$LOCAL_USER" 2> >(tee "$create_user_stderr" >&2)
  else
    java -cp "$jar" de.sluit.mediatracker.auth.CreateUser "$LOCAL_USER" 2> >(tee "$create_user_stderr" >&2)
  fi
  create_user_exit=$?
  set -e
  if [[ $create_user_exit -ne 0 ]]; then
    if grep -q "already exists" "$create_user_stderr"; then
      echo "User '$LOCAL_USER' already exists, moving on."
    else
      rm -f "$create_user_stderr"
      echo "error: creating user '$LOCAL_USER' failed (exit $create_user_exit)" >&2
      return "$create_user_exit"
    fi
  fi
  rm -f "$create_user_stderr"
}
