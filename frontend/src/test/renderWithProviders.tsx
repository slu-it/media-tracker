import type { ReactElement, ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppProviders } from "../AppProviders";
import { SearchDebounceContext } from "../hooks/useSearchDebounceMs";
import { LocationProbe } from "./LocationProbe";

/** Search debounce in tests: short enough to wait out on real timers, long enough to batch a paste. */
export const TEST_SEARCH_DEBOUNCE_MS = 100;

/**
 * `render` with the same theme/i18n/date-picker providers as main.tsx inside a `MemoryRouter` starting at `route`
 * (default `/`), applied via the `wrapper` option so `rerender` (e.g. reopening a dialog) keeps them too instead
 * of replacing the whole tree. `searchDebounceMs` (default `TEST_SEARCH_DEBOUNCE_MS`) sets the app-wide search
 * debounce; tests that assert before it fires pass a longer one.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = "/", searchDebounceMs = TEST_SEARCH_DEBOUNCE_MS }: { route?: string; searchDebounceMs?: number } = {},
): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AppProviders>
          <SearchDebounceContext value={searchDebounceMs}>{children}</SearchDebounceContext>
          <LocationProbe />
        </AppProviders>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
