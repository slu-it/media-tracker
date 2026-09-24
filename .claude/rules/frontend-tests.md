---
paths:
  - "frontend/src/**/*.test.{ts,tsx}"
  - "frontend/src/test/**"
  - "frontend/vitest.config.*"
  - "frontend/test-setup.ts"
---
# Frontend tests (Vitest, Testing Library, user-event)

Conventions and known jsdom limits (MUI Rating clicks) are in ADR 0012. Query through the accessibility tree
via `screen` (dialogs are portals); no `data-testid`.

- Render with `src/test/renderWithProviders.tsx`. Mock the network only with `src/test/mockFetch.ts`:
  `mockApi({"GET /api/games": ...})` records calls, and an unmocked request throws. Shared fixtures live in
  `src/test/fixtures/`; mirrored DTO changes must be reflected there.
- Any `console.error` during a test fails it.
- Never `await new Promise((r) => setTimeout(r, 0))` in a React test; use `await flushAsync()` from
  `src/test/flushAsync.ts`. The bare await is a gap outside `act`, and MUI Fade transition timers (~225ms) firing
  in it produce the CI-only "update to Transition was not wrapped in act" failure that passes locally.
- Open MUI selects with `user.click` on the combobox. Enter multi-character text with `user.click(field)` then
  `user.paste("...")`; per-keystroke `user.type` is about 10x slower and hit the CI timeout, keep it for single
  characters whose keystroke behaviour is under test.
- Derive expected URLs from feature constants (`GAMES_PAGE_SIZE`, `SEARCH_DEBOUNCE_MS`) instead of pinning
  numbers.
- Vitest runs with `testTimeout: 10_000` and `isolate: false` (one jsdom shared across files). `test-setup.ts`
  runs per file and does the lifecycle itself: explicit `afterEach(cleanup)`, a `beforeAll` setting
  `IS_REACT_ACT_ENVIRONMENT`, then the mocks (incl. `matchMedia` and an `Element.prototype.scrollIntoView` stub
  that @dnd-kit's keyboard sensor needs), language and `localStorage`. Never rely on state from another file and
  never remove those hooks. Vitest caps itself to 3 workers when `CI` is set.
- After a change to the Vitest config or `test-setup.ts`, run the suite once in CI mode (`CI=1`) and once
  shuffled (`--sequence.shuffle`) before calling it done.
- `pnpm test` runs `vitest run --coverage`; the V8 report in `frontend/build/coverage/` is informational, never
  add `thresholds`.
