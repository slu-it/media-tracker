# 0016: Container image on distroless Java, published to GHCR, docker compose as second deployment path

Status: accepted, 2026-09

## Context

Decision record 0002 fixed the deliverable as one fat JAR, deployed with `scp` plus `systemctl restart`; at the
time there was no container runtime on the Pi. That has changed: Docker is now installed there, and since
decision record 0015 it is a development requirement anyway. The JAR path has two drawbacks. The JDK on the Pi
must be kept at 25 by hand, and every deployment is three manual commands against a machine-specific layout
(`/opt/media-tracker`, a systemd unit, a JVM options file).

`master.yml` already builds and tests the JAR on every push. Publishing an image from the same run costs about a
minute and reduces a deployment to `docker compose pull && docker compose up -d`.

Constraints: the image must run as an unprivileged user, carry the JVM tuning of `deploy/jvm.options` (192 MB
heap, SerialGC, C1 only, auto-created CDS archive), keep the `CreateUser` bootstrap CLI invokable, and must not
disturb the local-development `docker-compose.yml` at the repository root, which starts MariaDB only.

## Decision

- **A plain `Dockerfile` at the repository root, one `COPY` of the built JAR onto
  `gcr.io/distroless/java25-debian13:nonroot`.** The Dockerfile never runs Gradle: `./gradlew build` (CI) or
  `:backend:buildFatJar` (local) produces the JAR first, and `.dockerignore` whitelists exactly that file, so the
  build context is the JAR and nothing else. The base image is Temurin 25 on Debian 13 with no shell and no
  package manager, user `nonroot` (uid/gid 65532), and an entry point equivalent to `/usr/bin/java -jar`, so
  `CMD ["/app/media-tracker.jar"]` is the whole runtime definition.
- **JVM flags as `ENV JAVA_TOOL_OPTIONS`**, duplicated from `deploy/jvm.options` with a keep-in-sync comment on
  both sides. Only the CDS archive path differs: `/tmp/media-tracker.jsa`, the one path the nonroot user can
  write. `JAVA_TOOL_OPTIONS` is chosen over baking the flags into an entry point because a compose
  `environment:` entry can then replace the whole set without rebuilding the image, and because
  `--entrypoint /usr/bin/java` keeps working for `CreateUser`. Sharing the options file is not possible: the
  launcher expands `@argfile` only on the command line, not inside `JAVA_TOOL_OPTIONS`.
- **No `HEALTHCHECK` in the image.** It has neither a shell nor curl, and a Java-based probe would start a JVM
  every interval on a Raspberry Pi. The compose file relies on `restart: unless-stopped`; `GET /health` stays
  available for external monitoring.
- **Published from `master.yml` only**, in the same job that builds and tests: `docker/setup-buildx-action`,
  `docker/login-action` with the workflow's `GITHUB_TOKEN` (`permissions: packages: write`),
  `docker/metadata-action` for tags and OCI labels, `docker/build-push-action` with
  `platforms: linux/arm64,linux/amd64` and `provenance: false`. Because the Dockerfile has no `RUN`, buildx
  assembles both platforms without QEMU emulation. Tags are `latest` (default branch only) and `sha-<short>`.
  No buildx layer cache: the only layer is the JAR, which changes on every build. The `media-tracker-jar`
  artifact is still uploaded. `pr.yml` builds the image and boots it against a MariaDB container, but never
  pushes.
- **`deploy/docker-compose.yml` is the Pi deployment**, next to and interchangeable with the systemd unit. It
  reads the same `/etc/media-tracker/env` through `env_file`, and adds `read_only: true`, `cap_drop: ALL`,
  `no-new-privileges`, a 512 MB memory limit, `stop_grace_period: 20s`, size-capped json-file logging, and a
  named volume `cds-archive` mounted at `/tmp` so the CDS archive survives restarts and reboots. That volume is
  the counterpart of `ReadWritePaths=/opt/media-tracker` in the systemd unit. `CreateUser` runs as
  `docker compose run --rm --no-deps -e JAVA_TOOL_OPTIONS= --entrypoint /usr/bin/java media-tracker -cp
  /app/media-tracker.jar de.sluit.mediatracker.auth.CreateUser <name>`. Clearing `JAVA_TOOL_OPTIONS` matters:
  a second JVM must not dump the CDS archive onto the file the running service has mapped.

## Consequences

- Two documented deployment paths (README "Deploy to the Pi"); the systemd unit and the JAR artifact stay as they
  are. Both bind port 8080, so a given Pi runs one of them, not both.
- `master.yml` needs `packages: write`. GHCR creates a new package as **private**; its visibility has to be
  switched to public once in the package settings before the Pi can pull without credentials.
- The compose project is named `media-tracker-app`, not `media-tracker`: the latter is the default project name
  of the repository's own `docker-compose.yml`, and a shared name would let `--remove-orphans` in either
  direction delete the other project's container. The container itself is still called `media-tracker`.
- The memory limit needs cgroup memory accounting, which Raspberry Pi OS enables only with
  `cgroup_enable=memory cgroup_memory=1` in `/boot/cmdline.txt`; without it Docker ignores the limit and only
  `-Xmx` applies.
- The base image is referenced by tag, so Debian and Temurin patch updates arrive with the next master build.
  If reproducibility becomes a concern, pin the digest and let Dependabot bump it.
- `deploy/jvm.options` and the Dockerfile's `ENV` line are kept in sync by hand. `-Xmx` and the compose memory
  limit move together: the heap flag caps the heap only, while metaspace, code cache, thread stacks and the
  mapped CDS archive add roughly 150 to 250 MB on top.
- Nothing new is required on a developer machine; Docker is already needed for the backend tests. A local
  `docker build` without the buildx plugin produces a single-architecture image for the host, which is enough
  for testing.

## Alternatives considered

- **The Ktor Gradle plugin's `buildImage` / `publishImage` (Jib).** Needs no Docker daemon and could push to
  GHCR from Gradle, but it moves the image definition into the Kotlin DSL, pulls registry credentials into the
  build, and hides what is otherwise a six-line Dockerfile behind plugin conventions.
- **A multi-stage Dockerfile that runs Gradle and Node inside the build.** Self-contained, but slow, it
  duplicates the CI caching that already exists, and a multi-architecture build stage would need QEMU. The JAR
  is the build output; the image only has to wrap it.
- **`eclipse-temurin:25-jre` as base.** Has a shell for debugging and is a familiar image, but runs as root by
  default and ships a full userland the application never uses. Distroless keeps the attack surface at the JVM
  plus the JAR, and `debug-nonroot` provides a busybox shell for a one-off diagnosis.
- **Alpine or a jlink-ed custom runtime.** Smaller, but musl or a jdeps/jlink step adds moving parts for a
  saving that does not matter on the Pi's SD card.
- **Publishing images for pull requests.** No consumer, and it clutters the package listing. `pr.yml` builds and
  boots the image instead, which is what actually protects master.
- **A second workflow job that downloads the JAR artifact and pushes the image.** An artifact round trip for no
  benefit; one job is simpler.
- **Semantic version tags.** The project has no releases or git tags yet. `latest` plus `sha-<short>` is what the
  `compose pull` flow needs; revisit when releases start.
