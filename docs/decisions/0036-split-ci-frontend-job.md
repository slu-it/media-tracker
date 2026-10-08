# 0036: CI runs the frontend and the backend build as separate jobs

Status: accepted, 2026-10

## Context

Both workflows ran `./gradlew build --max-workers=2` in one job on one GitHub-hosted runner. Vitest (capped to 3
workers in CI) ran at the same time as the Kotlin compilation and the Testcontainers MariaDB tests. The jsdom +
MUI dialog tests are CPU-bound, so they slowed down roughly in proportion to the contention. In one PR run,
`AddBookDialog.test.tsx` took 7–10 s per test (0.7–1.2 s locally), two tests hit the 10 s `testTimeout`, and the
whole Vitest run took 195 s. The resulting `act(...)` warning from MUI's `TouchRipple` was a consequence of the
timeout: the abandoned test's ripple timers fired outside `act`. Raising the timeout further would only hide the
contention, and capping workers harder would make the whole build slower.

## Decision

- `pr.yml` and `master.yml` have a `frontend` job running `./gradlew :frontend:build` (ESLint, Prettier check,
  Vitest, Vite build), and the existing job runs `./gradlew :backend:build` (ktlint, backend tests, fat JAR with
  the SPA via `frontendDist`, image build and smoke run or publish). The union of the two task sets is exactly
  `./gradlew build` (checked with `--dry-run`). Locally `./gradlew build` stays the single contract.
- On PRs both jobs run in parallel. On `master` the backend job `needs: frontend`, so the JAR artifact and the
  image are only published after every check passed.
- The CI caps are gone: no `--max-workers=2` for Gradle, no `maxWorkers` for Vitest in CI.
- Independently of the split, `renderWithProviders` turns off MUI ripple and transitions in tests (record 0012),
  which removes the ripple and transition timers that fire outside `act`.

## Consequences

- PR wall-clock time is the slower of the two jobs instead of their contended sum. Each job pays its own
  checkout, JDK, Gradle and Node/pnpm cache restore, and both run the Vite build (the frontend job as part of
  `:frontend:build`, the backend job for the SPA it packages).
- On `master` the jobs run one after the other. That is accepted for the guarantee that nothing failing is
  published; a separate publish job would avoid it, but it would have to move the JAR between jobs.
- A new Gradle task outside both `:frontend:build` and `:backend:build` would silently not run in CI. Keep
  checks hooked into a project's `check`.
- A failing frontend job uploads `frontend-reports` (Vitest JUnit XML and coverage). The backend job keeps
  `reports`.
