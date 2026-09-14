# 0002: One fat JAR serves API, login page and SPA

Status: accepted, 2026-09

## Context

Deployment target is a single Raspberry Pi administered over SSH. There is no reverse proxy, no container
runtime, and no CDN in the picture.

## Decision

`./gradlew build` produces `backend/build/libs/media-tracker.jar` containing the Ktor server, the
hand-written login page and the compiled React app. Deployment is `scp` plus `systemctl restart`.

## Reasons

- One artifact, one process, one systemd unit. Nothing to keep in sync between a static-file server and an
  API server, and the session cookie is trivially same-origin.
- The login page is plain HTML/CSS served by Ktor, so the React bundle itself never leaves the
  authenticated tier. Unauthenticated clients only ever see `/login`, `/login/static/*` and `/health`.
- Cache headers are under the application's control (`private`, long-lived only for hashed assets).

## Consequences

- Frontend changes require a backend redeploy. Acceptable for a single-user service.
- The frontend build must feed into the backend's resources. This is done through a Gradle consumable
  configuration (`frontendDist`) rather than a cross-project task reference, see `docs/architecture.md`.
- `backend/src/main/resources/app/` stays empty in git and is never written to; the copy lands in
  `build/resources/main/app`.
