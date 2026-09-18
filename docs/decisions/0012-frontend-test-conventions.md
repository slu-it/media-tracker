# 0012: Frontend test conventions: behaviour through the accessibility tree, `fetch` as the only mock boundary, noise fails the test

Status: accepted, 2026-09

## Context

After MT-001 the frontend had 19 Vitest files and about 93 % statement coverage, and the owner asked whether the
suite was complete, reproducible and idiomatic. A review found the patterns sound (role and label queries, no
`data-testid`, `userEvent.setup()` per test, request payload assertions, validators and hooks tested on their
own) but the number hid three gaps and two blind spots:

- The wiring in `GamesView.tsx` was never exercised: deleting the last game of a later page must step back a
  page, deleting elsewhere must reload, save and create must refresh the list. Only the leaf dialogs had tests.
- `apiFetch`'s 401 redirect, network failures and non-JSON error bodies had no test; the stale-response guard in
  `useGamesPage`/`useGamePlatforms` had none either.
- An unmocked request answered a silent 404, so a forgotten mock showed up as an error alert instead of a
  failing test; nothing failed a test on `console.error`, so React `act()` and MUI prop warnings could pile up.
- `:frontend:pnpmTest` declared `outputs.upToDateWhen { false }` and re-ran on every `./gradlew build`.
- The `afterEach` order (`localStorage.clear()` then `i18n.changeLanguage("en")`) re-wrote `mt.language=en`
  into storage after clearing it, because the language listener persists every change. No test read storage
  first, so it went unnoticed.

Books, Movies and Series will copy `features/games/` and its tests, so the conventions are written down now.

## Decision

- **Query what the user perceives.** Elements are found by role, accessible name or label text through
  `screen`; `data-testid`, class names and `container.querySelector` are not used. The one exception is a
  structural layout assertion ("the rating sits in the same column as the cover", "bottom actions are pushed
  down"), which may walk `parentElement`/`closest` behind a per-line `testing-library/no-node-access` disable
  with a reason. Assertions use the literal English copy; every test starts and ends in `en` (global
  `afterEach`), and `i18n/resources.test.ts` keeps the German bundle complete.
- **Test levels, copied per media kind.** Pure domain (`domain/*Values`, `domain/*Draft`), hooks through
  `renderHook`, one file per self-validating field, one per dialog (request method, path and body asserted),
  one for the view's wiring (paging, empty/error states, delete/save/create callbacks), the `App` smoke test and
  `api/client.test.ts` for the transport. One behaviour per `it`, names read as sentences.
- **`fetch` is the only mock boundary.** `src/test/mockFetch.ts` (`mockApi`) routes `"METHOD /path"` keys with
  `:id` segments and records `{ method, url, body }`; own modules are never `vi.mock`ed. An unmatched request
  is recorded in `unmockedRequests` (and rejected); the global `afterEach` fails the test if the list is not
  empty. The rejection alone would not do: components catch it and show the same error alert as any failure.
- **Noise fails the test.** `src/test-setup.ts` spies `console.error` in `beforeEach` and throws in `afterEach`
  if it was called or if a request went unmocked. Fix the cause (missing `await`, missing `act`, invalid prop,
  missing route); never allow-list globally.
- **Cleanup order is `vi.restoreAllMocks()` → `i18n.changeLanguage("en")` → `localStorage.clear()`**, so the
  language listener's write is cleared too.
- **Fixtures live in `src/test/fixtures/<kind>.ts`** (platforms and sample games for `games`), not per file.
- **Test files are linted with `eslint-plugin-testing-library` (`flat/react`) and `@vitest/eslint-plugin`
  (`recommended`)**, scoped to `src/**/*.test.*`, `src/test/**` and `src/test-setup.ts` in `eslint.config.js`;
  rule disables are per line with a reason.
- **`:frontend:pnpmTest` is an ordinary incremental Gradle task**: inputs are `src/`, the Vite and TS configs,
  `package.json` and `pnpm-lock.yaml`; `--rerun-tasks` forces a rerun. Coverage stays informational (0011).

Known limits, accepted: MUI `Rating` derives the value from pointer geometry, which jsdom reports as zero, so a
star click yields `NaN`; rating changes are covered by the `gameValues` validators and the field's display
states only. The 401 redirect is asserted by redefining `window.location` with `Object.defineProperty`; that
works because Vitest's jsdom environment installs a configurable `location` on the Node global (real jsdom
makes it unforgeable). If a future Vitest closes that, add a one-line `navigation.assign` indirection in
`api/client.ts` rather than skipping the test. The stored language is restored once, when `i18n/index.ts`
loads (`readStoredLanguage() ?? DEFAULT_LANGUAGE`); i18next is a singleton that `vi.resetModules()` cannot
re-create, so that line is covered through `i18n/language.test.ts`, not through `<App />`.

## Alternatives not taken

- **MSW instead of `mockApi`.** The router is about 50 lines, records calls in the shape the tests assert, and has no
  service-worker or Node interception setup. Revisit if tests need headers, streaming or shared handlers across
  many kinds.
- **Asserting i18n keys instead of copy.** Users see copy; a wrong key would pass while the screen shows
  `games.addGame`. The key-parity test protects the German bundle instead.
- **Coverage thresholds.** Same reasoning as 0011: the number is a map of what to look at, not a gate. This
  review is the example: 93 % hid the untested view wiring.
- **Browser end-to-end tests (Playwright).** The backend smoke tests and the view wiring tests already cover the
  seams; a browser suite is worth its cost once a second media kind exists.

## Consequences

- A new media kind copies from `games`: `domain/*.test.ts`, `hooks/*.test.tsx`, `components/fields/*.test.tsx`,
  `components/*Dialog.test.tsx`, `<Kind>View.test.tsx` with the four callback tests, and a fixtures module.
- The reviewer checklist gains: role/label queries only, every hit route mocked, request payload asserted for
  create/update/delete, no `console.error` allow-listing, no `vi.mock` of own modules.
- Decision records 0008 (frontend stack, tests bullet) and 0011 (coverage paragraph) point here.
