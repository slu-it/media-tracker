# 0037: Tests render without emotion styles in the document, and CI's test timeout only detects hangs

Status: accepted, 2026-10

## Context

Even after the CI split (0036), a dialog test occasionally ran into the 10 s `testTimeout` on GitHub Actions. On a
12-core developer machine the slowest test (`AddBookDialog` "posts the filled form and reports the created book")
takes 1.1 s alone and 3.2 s in a parallel run with coverage, which is how CI runs it; the CI runner has fewer and
slower cores, which puts the same test at 7–10 s. Nothing in these tests waits or hangs: they are CPU-bound.

A CPU profile of `AddBookDialog.test.tsx` showed where the time goes. User input is not the cost (multi-character
input is already pasted, 0012):

- About a third of the CPU went to jsdom's `window.getComputedStyle`, which re-runs the full stylesheet cascade on
  every call without caching. MUI's emotion injects hundreds of rules into `<head>`, so each call matches all of
  them against the element and its ancestors.
- 85% of those calls came from `dom-accessibility-api`'s `isHidden`, which `computeAccessibleName` calls for every
  candidate node of a name-filtered `*ByRole(..., { name })` query. About 80% of the 1,800 role queries in the
  suite filter by name, and a form test runs dozens of them, each after a click that re-renders the form.
- `configure({ defaultHidden: true })` did not help: it only skips Testing Library's own `isInaccessible` check,
  about 1% of the profile.
- The rest is React rendering, emotion serialisation and user-event dispatch, i.e. real work of the code under
  test.

Rendering with an emotion cache whose container is never attached to the document removes the cascade: emotion
still serialises and inserts the rules, but jsdom has no stylesheet to apply. That halved the heavy dialog tests
(slowest test 1.13 s to 0.62 s alone, `AddBookDialog.test.tsx` 6.0 s to 3.2 s) and cut the full suite with
coverage from 23 s to about 14–15 s. 21 tests in 13 files failed with it, all because they assert real CSS:
`toHaveStyle` (cover grayscale and opacity, dialog sizing, dimmed toggles), direct `getComputedStyle` checks on the
visually hidden results row, and one query that matched a date-picker button hidden by CSS. More tests made
negative style assertions (`not.toHaveStyle`, "the row is not hidden") that kept passing without CSS, i.e. they
had stopped testing anything.

## Decision

- `renderWithProviders` wraps the tree in an emotion `CacheProvider` with a module-level cache
  (`createCache({ key: "test", container: <detached div> })`). `@emotion/cache` is a direct devDependency.
- The option `realStyles: true` renders with a fresh emotion cache in `<head>` instead, so computed styles are
  real, and flushes its `<style>` tags on unmount. Emotion's default cache is not used: with `isolate: false` its
  tags would stay in the shared jsdom and slow down every later file on that worker.
- Every test asserting computed style or visibility opts in, positive or negative: `toHaveStyle`,
  `not.toHaveStyle`, `toBeVisible`, `not.toBeVisible`, direct `getComputedStyle`, or relying on an element hidden
  by CSS. Only checks that expect a real CSS value (`toHaveStyle`, "the row is hidden") fail without it; negative
  assertions and `toBeVisible` (every element counts as visible without CSS) pass vacuously, so the rule is by
  assertion, not by failure.
- `testTimeout` is 10 s locally and 30 s when `CI` is set. Locally the timeout stays a signal that a test has become
  too slow; on the shared CI runner, whose speed varies from run to run, it only detects hangs. This revises the
  0036 stance of not raising the timeout: since that split, the remaining failures were plain CPU variance, not
  contention a higher timeout would hide.

## Consequences

- The default render no longer shows real CSS. An assertion expecting a CSS value fails loudly without
  `realStyles: true`; negative ones (`not.toHaveStyle`, "is not hidden") and `toBeVisible` pass vacuously. Review
  has to check the opt-in for those.
- The `realStyles` cache is flushed when the test unmounts. That relies on tests not rendering in StrictMode, whose
  extra cleanup would flush rules emotion never inserts again.
- Name-filtered role queries still compute accessible names, and `isHidden` still checks inline styles and the
  `hidden` attribute, so the accessibility-tree query style of 0012 stays unchanged.
- A test that becomes slow on CI shows up locally first, as long as it is above 10 s on a developer machine; one
  between the local and the CI budget on CI only is not caught. The Vitest JUnit report in `frontend-reports` has
  per-test durations.
- Coverage (about 40% of the run time) stays on in CI; making it a separate step was considered and left open.
