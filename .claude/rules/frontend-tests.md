---
paths:
  - "frontend/src/**/*.test.{ts,tsx}"
  - "frontend/src/test/**"
  - "frontend/vitest.config.*"
  - "frontend/src/test-setup.ts"
---
# Frontend tests (Vitest, Testing Library, user-event)

Conventions and known jsdom limits are in ADR 0012; click MUI Rating stars with `fireEvent.click` on the
quarter-star radio and a non-zero `clientX`/`clientY` (not `user.click`, whose hover yields `NaN`); test the hover
preview by mocking `getBoundingClientRect` and firing `mouseMove`/`mouseLeave` (focus never emits
`onChangeActive`). Query through the accessibility tree via `screen` (dialogs are portals); no `data-testid` of our
own. Exception: decorative, `aria-hidden` MUI icons are not in the accessibility tree, so assert them via the
`data-testid` MUI generates (`SportsEsportsIcon`, or `within(option).queryAllByTestId(/Icon$/)` to count them).

- Render with `src/test/renderWithProviders.tsx`. It passes `TEST_THEME_OVERRIDES` to `AppProviders`: no MUI ripple
  (its timers are gone) and every transition duration 0 (MUI's `Transition` still finishes in a 0 ms timeout, so
  `flushAsync` stays the rule below). Never assert on an intermediate transition state. Its `route` option (default `/`) sets the `MemoryRouter`
  entry. Assert URLs with `currentLocation()` (`src/test/currentLocation.ts`, reads a hidden location probe)
  and drive history with `src/test/HistoryControls.tsx` (`window.history` does nothing under `MemoryRouter`).
  Mock the network only with `src/test/mockFetch.ts`:
  `mockApi({"GET /api/games": ...})` records calls, and an unmocked request throws. Shared fixtures live in
  `src/test/fixtures/`; mirrored DTO changes must be reflected there.
- `renderWithProviders` renders with an emotion cache whose container is detached, so no MUI CSS reaches jsdom and
  name-filtered `*ByRole` queries skip the costly `getComputedStyle` cascade (ADR 0037). Pass `{ realStyles: true }`
  in every test asserting computed style or visibility, positive or negative: `toHaveStyle`, `not.toHaveStyle`,
  `toBeVisible`, `not.toBeVisible`, direct `getComputedStyle`, or relying on an element hidden by CSS. Negative
  assertions and `toBeVisible` pass vacuously without it. An unexpected duplicate match is also a sign to opt in.
- Any `console.error` during a test fails it.
- Never `await new Promise((r) => setTimeout(r, 0))` in a React test; use `await flushAsync()` from
  `src/test/flushAsync.ts`. The bare await is a gap outside `act`, and MUI transition timers (0 ms in tests) firing
  in it produce the CI-only "update to Transition was not wrapped in act" failure that passes locally.
- Open MUI selects with `user.click` on the combobox. Enter multi-character text with `user.click(field)` then
  `user.paste("...")`; per-keystroke `user.type` is about 10x slower and hit the CI timeout, keep it for single
  characters whose keystroke behaviour is under test.
- Derive expected URLs from feature constants (`GAMES_PAGE_SIZE`) instead of pinning numbers.
- Search debounces read `SearchDebounceContext` (`src/hooks/useSearchDebounceMs.ts`); `renderWithProviders` sets
  100 ms (`TEST_SEARCH_DEBOUNCE_MS`). Never add a delay prop to a component. Pass an explicit `{ searchDebounceMs }`
  only when the test depends on the delay: it asserts something before the debounce fires (no request yet,
  coalescing, Enter/Clear bypassing it) or waits a fixed time against it. A `waitFor` timeout that must beat the
  debounce stays well below it. Debounced hooks keep an optional `debounceMs` argument for `renderHook` tests.
- Vitest runs with `testTimeout` 10 s locally (30 s with `CI` set, where it only detects hangs; ADR 0037) and
  `isolate: false` (one jsdom shared across files). `test-setup.ts`
  runs per file and does the lifecycle itself: explicit `afterEach(cleanup)`, a `beforeAll` setting
  `IS_REACT_ACT_ENVIRONMENT`, then the mocks (incl. `matchMedia`, an `Element.prototype.scrollIntoView` stub
  that @dnd-kit's keyboard sensor needs, and an unconditional no-op `window.scrollTo` for `PaginationBar`, since
  jsdom defines it as a not-implemented function that logs a console.error), language and `localStorage`. Never rely on state from another file and
  never remove those hooks. Vitest runs on its core-based default everywhere; in CI it has a runner of its own
  (ADR 0036).
- After a change to the Vitest config or `test-setup.ts`, run the suite once in CI mode (`CI=1`) and once
  shuffled (`--sequence.shuffle`) before calling it done.
- `pnpm test` runs `vitest run --coverage`; the V8 report in `frontend/build/coverage/` is informational, never
  add `thresholds`.
