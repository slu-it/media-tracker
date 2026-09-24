---
paths:
  - "**/*.gradle.kts"
  - "gradle/**"
  - "frontend/package.json"
  - "frontend/vite.config.*"
  - ".github/**"
  - "Dockerfile"
  - "docker-compose.yml"
  - "deploy/**"
  - "*.sh"
---
# Build, CI, dependencies and deployment

**Frontend -> backend handoff.** `:frontend` exposes Vite's output (`frontend/build/dist`) as a consumable Gradle
configuration `frontendDist`; `:backend` resolves it as a dependency and copies it into `build/resources/main/app/`
during `processResources`. Never reference `:frontend` tasks from `:backend`, and never write into
`backend/src/main/resources/app/` (gitignored, must stay empty). `-Pmt.dev=true` drops that copy and puts `run`
into Ktor development mode (dev loop only, Vite serves the SPA, ADR 0006); never pass it to `build`/`buildFatJar`.
Inside Claude Code (`CLAUDECODE=1`, set in every agent shell) `:backend:test` logs only failed and skipped tests.
Agents take their totals from `.claude/scripts/test-summary.py`, while a terminal or IDE build prints every test.
`-Pmt.agent=true|false` overrides the detection. Switching between the two environments costs one configuration-cache miss.
Gradle runs with configuration cache, build cache and parallel on. `frontend/build.gradle.kts` must keep
`node.version` and `pnpmVersion` as literal strings (node-gradle 7.1.0 configuration-cache bug).

**Lint and format** (ADR 0005). ktlint uses the `intellij_idea` style from `.editorconfig` (4 spaces, 120 columns)
with `no-unused-imports` explicitly enabled (off by default in ktlint 1.x); the plugin is applied only in
`:backend`, root and frontend Gradle scripts are not linted. Prettier uses `printWidth: 120` with 2-space
indentation; `frontend/eslint.config.js` is a flat config (typescript-eslint non-type-aware recommended,
react-hooks, react-refresh, eslint-config-prettier). detekt is intentionally absent until detekt 2.0 (Kotlin 2.4)
is GA.

**Versions.** `gradle/libs.versions.toml` is the single source for JVM versions; npm packages are pinned exactly in
`frontend/package.json` (no `^`). Stay on the current majors and take the newest release within each (npm side:
MUI 9, Emotion 11, i18next 26, react-i18next 17, @dnd-kit/core 6 + /sortable 10 + /utilities 3; `utilities` is a
direct dependency because the page imports `CSS` from it and pnpm does not hoist). Do not bump majors (pnpm 12,
TypeScript 7, Logback 1.6, ...) without asking. `@vitest/coverage-v8` declares the exact Vitest version as a peer
dependency, so bump both to the same version. A dependency change runs `pnpm install` and commits the resulting
`frontend/pnpm-lock.yaml`; CI uses a frozen lockfile.

**CI.** `.github/workflows/pr.yml` (pull requests to `master`) and `master.yml` (push to `master`) both run
`./gradlew build` on JDK 25 with Gradle and Node/pnpm caches; `master.yml` uploads
`backend/build/libs/media-tracker.jar` as the `media-tracker-jar` artifact. CI passes `--max-workers=2` to Gradle
and Vitest caps itself to 3 workers when `CI` is set (few-core runner, backend build and frontend tests overlap).
`master.yml` also builds the root `Dockerfile` (one `COPY` of the JAR onto
`gcr.io/distroless/java25-debian13:nonroot`) with buildx for linux/arm64+amd64 and pushes
`ghcr.io/slu-it/media-tracker:{latest,sha-<short>}` (`permissions: packages: write`, `GITHUB_TOKEN`); `pr.yml`
only `docker build`s it and boots it against the root-compose MariaDB (`/health`). Never publish from `pr.yml`.
The JVM flags live as `JAVA_TOOL_OPTIONS` in the Dockerfile and are mirrored from `deploy/jvm.options`: change both
(ADR 0016).

**Deployment.** The Pi runs either the systemd unit or `deploy/docker-compose.yml` (ADR 0016), documented in the
README. The database is the Pi's central MariaDB, `deploy/database/` as its own compose project: it publishes no
port, owns the Docker network `pi-db` that the app's compose file joins as external and addresses as `mariadb`,
and its databases plus owning users come from `deploy/database/create-database.sh` (ADR 0018). Media Tracker uses
database and user `media-tracker` there; local development keeps `mediatracker` from the repository-root
`docker-compose.yml`. Shared local env and helpers live in `local-env.sh`. When checking a local server, use a
free port: a leftover dev server on :8080 makes health checks pass falsely.
