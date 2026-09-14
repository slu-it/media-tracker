# 0005: ktlint for Kotlin, ESLint + Prettier for the frontend; detekt deferred

Status: accepted, 2026-09

## Context

Until now the only automated quality gates were the compilers (`tsc -b` in strict mode, Kotlin defaults),
Flyway's naming validation and `SchemaDriftTest`. `.editorconfig` described the style but nothing enforced it.
We want style and lint violations to fail `./gradlew build` so reviews can ignore formatting.

## Decision

- **Backend: ktlint 1.8.0** through the `org.jlleitschuh.gradle.ktlint` Gradle plugin 14.2.0, applied in
  `backend/build.gradle.kts`. `ktlintCheck` is part of `:backend:check`; `ktlintFormat` fixes what it can.
  Code style is `intellij_idea` (set in `.editorconfig`), matching `kotlin.code.style=official` in
  `gradle.properties`, so IntelliJ's formatter and ktlint agree. The default `ktlint_official` style would have
  rewrapped most function signatures and multiline expressions for no gain.
  `no-unused-imports` is disabled by default in ktlint 1.x (it works without type resolution and can misfire on
  imports used only in KDoc or by operators); it is enabled here via `ktlint_standard_no-unused-imports = enabled`
  because the Kotlin compiler does not warn about unused imports either. Disable it again if it misfires.
- **Frontend: ESLint 10** (flat config, `frontend/eslint.config.js`) with `@eslint/js`, `typescript-eslint`
  (non-type-aware `recommended`), `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`, plus
  **Prettier 3** (`printWidth: 120`, indentation from `.editorconfig`). `eslint-config-prettier` turns off the
  ESLint style rules. Gradle wraps them as `pnpmLint` and `pnpmFormatCheck`, both part of `:frontend:check`;
  `pnpmFormat` and `pnpmLintFix` rewrite files.
- **detekt is not added yet.** Its stable line (1.23.8, Feb 2025) embeds a Kotlin 2.0.21 compiler; with
  Kotlin 2.3+ it produces false positives and the maintainers closed the issue as "not planned" for 1.x. The
  2.0 line (`dev.detekt`, 2.0.0-alpha.6) targets Kotlin 2.4 and Gradle 9 but is alpha. Revisit when detekt 2.0
  reaches GA; the intended setup is the plain `detekt` task with a YAML config, no `detekt-formatting`
  (ktlint owns formatting).

## Alternatives not taken

- Vite's `react-ts` template now ships `oxlint` instead of ESLint. It is faster but has no typescript-eslint
  type-aware rules and a smaller plugin ecosystem; ESLint keeps the upgrade path to
  `tseslint.configs.recommendedTypeChecked` with `parserOptions.projectService`.
- Biome (lint + format in one tool): same trade-off as oxlint.
- detekt with the `detekt-formatting` ruleset instead of ktlint directly: formatting would lag ktlint releases,
  and detekt itself is blocked on the Kotlin version (above).

## Consequences

- `./gradlew build` fails on any ktlint, ESLint or Prettier finding. Run `./gradlew :backend:ktlintFormat` and
  `cd frontend && pnpm format` (or `./gradlew :frontend:pnpmFormat`) before committing.
- Verified 2026-09: a spacing violation in `Application.kt` fails `:backend:ktlintCheck`; a quote-style change and an
  unused variable in `App.tsx` fail `pnpmFormatCheck` and `pnpmLint` respectively.
- The ktlint plugin only registers tasks in projects with the Kotlin plugin, so `frontend/build.gradle.kts`,
  the root `build.gradle.kts` and `settings.gradle.kts` are not linted by the build. They were formatted once with
  the ktlint CLI; keep them tidy by hand.
- The version catalog has both `ktlint` and `ktlint-plugin` versions, so the accessor is
  `libs.versions.ktlint.asProvider()`.
