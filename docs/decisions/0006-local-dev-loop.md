# 0006: Local dev loop with Ktor auto-reload and the Vite dev server

Status: accepted, 2026-09

## Context

Until now the local loop was `build-and-start-locally.sh` (full `./gradlew build`, then the fat JAR) or, for the
frontend alone, `cd frontend && pnpm dev`. Backend changes meant a restart, `./gradlew :backend:run` always
rebuilt the SPA through the `frontendDist` dependency, and the local environment variables lived only in the
build script. We want one command that gives live code updates for both halves without touching production
behaviour.

## Decision

- **Backend live reload uses Ktor's built-in auto-reload**, driven by Gradle's continuous build:
  `./gradlew :backend:run -Pmt.dev=true` in one process and `./gradlew :backend:classes -t -Pmt.dev=true` in a
  second. `backend/build.gradle.kts` adds `-Dio.ktor.development=true` to the `run` JVM when `mt.dev` is set.
  Ktor then loads the application module in a child-first class loader over the watched classpath directories
  and swaps it on the first request after class files changed. The default watch pattern is the working
  directory (`backend/`), which already matches `backend/build/classes` and `backend/build/resources`, so
  `application.yaml` needs no `ktor.development` or `ktor.deployment.watch` keys. Deliberately so: a
  `ktor.development` config key would take precedence over the system property and make the flag silently
  ineffective.
- **Frontend live reload stays the Vite dev server** on :5173 with its existing proxy for `/api`, `/login`,
  `/logout` and `/health`; redirects and the session cookie are relative/host-only, so the login gate works
  unchanged behind the proxy.
- **`-Pmt.dev=true` also removes the SPA copy from `:backend:processResources`** at configuration time. Without
  it, `:backend:run` would run the Vite production build and `:backend:classes -t` would watch `frontend/src`
  and rebuild the SPA on every frontend edit. Removing the `from(frontendDist)` (rather than `onlyIf`) is what
  takes the frontend inputs out of the continuous build. One property covers both dev-loop effects; it is a
  configuration-cache input, so the dev and release variants get separate cache entries.
- **`start-dev.sh` orchestrates it**: Docker MySQL, backend, health wait, then compiler and Vite, with prefixed
  output and a Ctrl+C that stops all three. `local-env.sh` holds the local environment and the user-creation
  helper shared with `build-and-start-locally.sh`.
- **Shutdown hooks are per application instance.** Ktor starts the new module before it stops the old one and the
  `monitor` is shared across instances, so `monitor.subscribe(ApplicationStopped) { database.close() }` would
  close the *new* pool and leak a handler per reload. `module()` now uses
  `coroutineContext.job.invokeOnCompletion { database.close() }`, and `ConnectedDatabase.close()` also calls
  `TransactionManager.closeAndUnregister` so reloads do not accumulate dead Exposed databases.

## Alternatives not taken

- Restart-on-change (e.g. a file watcher that kills and restarts `:backend:run`): a JVM restart plus Hikari and
  Flyway startup per change is several seconds; Ktor's class-loader swap is sub-second and keeps the port open.
- A dev source set or separate Gradle module for the frontend-less backend: heavier than one property.
- A Gradle task wrapping `pnpm dev`: Gradle buffers and mangles long-running interactive output; the script adds
  the Gradle-managed Node/pnpm to `PATH` instead when `pnpm` is not installed.
- The Ktor Gradle plugin's own switch, `-Pio.ktor.development=true`: documented, but in plugin 3.5.2 the
  `KtorExtension.development` property chains two `convention()` calls and the second replaces the first, so only
  the Gradle system property form (`./gradlew -Dio.ktor.development=true`) is honoured (verified against the
  generated start script). Setting the JVM flag ourselves is one line and does not depend on that quirk.
- Putting `ktor.development: "$KTOR_DEVELOPMENT:false"` into `application.yaml`: works, but see the precedence
  note above; keeping the switch in the build script leaves the production config free of dev switches.

## Consequences

- The backend reloads lazily on the next request, not on save. Config (`application.yaml`) and build-script
  changes still need a restart of `start-dev.sh`.
- In dev mode `:8080` serves only the login page and the API; the SPA comes from `:5173`.
- Every reload reconnects HikariCP and re-runs Flyway (a no-op when the schema is current); briefly two pools
  exist. Fine for local MySQL, irrelevant in production where development mode is off.
- Never combine `-Pmt.dev=true` with `build`, `buildFatJar` or `:backend:run` without Vite, or the SPA is
  missing from the result.
