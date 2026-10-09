import { useEffect, type ReactElement, type ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import type { ThemeOptions } from "@mui/material/styles";
import { MemoryRouter } from "react-router";
import { AppProviders } from "../AppProviders";
import { SearchDebounceContext } from "../hooks/useSearchDebounceMs";
import { LocationProbe } from "./LocationProbe";

/** Search debounce in tests: short enough to wait out on real timers, long enough to batch a paste. */
export const TEST_SEARCH_DEBOUNCE_MS = 100;

/**
 * Tests only: no ripple and zero-length transitions. TouchRipple timers (80 ms delay, 550 ms exit) fired outside
 * `act` (CI-only "not wrapped in act" failures); Fade/Grow/Dialog transitions (~225 ms) made `waitFor`/`findBy`
 * poll through animations and now end in a 0 ms timeout. Production keeps the real theme.
 */
const TEST_THEME_OVERRIDES: ThemeOptions = {
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
  transitions: {
    create: () => "none",
    duration: {
      shortest: 0,
      shorter: 0,
      short: 0,
      standard: 0,
      complex: 0,
      enteringScreen: 0,
      leavingScreen: 0,
    },
  },
};

/**
 * Emotion cache whose container is never attached to the document, so MUI's hundreds of style rules land nowhere
 * jsdom cascades. Every name-filtered `ByRole` query calls `getComputedStyle` per candidate (dom-accessibility-api's
 * `isHidden`), and jsdom re-runs the full cascade for each call: with the rules in `<head>` that halves the speed of
 * the heavy dialog tests (ADR 0037).
 */
const detachedStyleCache = createCache({ key: "test", container: document.createElement("div") });

/**
 * `render` with the same theme/i18n/date-picker providers as main.tsx inside a `MemoryRouter` starting at `route`
 * (default `/`), applied via the `wrapper` option so `rerender` (e.g. reopening a dialog) keeps them too instead
 * of replacing the whole tree. `searchDebounceMs` (default `TEST_SEARCH_DEBOUNCE_MS`) sets the app-wide search
 * debounce; tests that assert before it fires pass a longer one. Styles are detached by default (see
 * `detachedStyleCache`), so computed styles are empty. Pass `realStyles: true` for every test that asserts computed
 * style or visibility, positive or negative (`toHaveStyle`, `not.toHaveStyle`, `toBeVisible`, `not.toBeVisible`,
 * `getComputedStyle`) or relies on elements hidden by CSS: negative assertions and `toBeVisible` pass vacuously
 * without it (ADR 0037).
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    searchDebounceMs = TEST_SEARCH_DEBOUNCE_MS,
    realStyles = false,
  }: { route?: string; searchDebounceMs?: number; realStyles?: boolean } = {},
): RenderResult {
  // `realStyles`: a fresh cache in `<head>` per render, flushed on unmount. The default cache would leave its
  // `<style>` tags in the document shared by all later files of the worker (`isolate: false`).
  const realCache = realStyles ? createCache({ key: "real" }) : null;
  function Wrapper({ children }: { children: ReactNode }) {
    // Relies on tests not rendering in StrictMode: its extra mount/cleanup would flush rules emotion then never
    // re-inserts.
    useEffect(() => () => realCache?.sheet.flush(), []);
    const tree = (
      <MemoryRouter initialEntries={[route]}>
        <AppProviders themeOverrides={TEST_THEME_OVERRIDES}>
          <SearchDebounceContext value={searchDebounceMs}>{children}</SearchDebounceContext>
          <LocationProbe />
        </AppProviders>
      </MemoryRouter>
    );
    return <CacheProvider value={realCache ?? detachedStyleCache}>{tree}</CacheProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}
