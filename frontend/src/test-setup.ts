import "@testing-library/jest-dom/vitest";
// eslint-disable-next-line testing-library/no-manual-cleanup -- see cleanup() in afterEach below
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, vi, type MockInstance } from "vitest";
import i18n from "./i18n";
import { unmockedRequests } from "./test/mockFetch";

// jsdom has no matchMedia; MUI guards its use, but a stub keeps any future useMediaQuery from throwing.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// An unexpected console.error usually means an act() warning, an unhandled rejection log or a component
// error boundary firing: real problems that should fail the test rather than scroll by silently.
let errorSpy: MockInstance<(...args: Parameters<typeof console.error>) => void>;

// Testing Library sets React's act-environment flag in a beforeAll and restores it in an afterAll, both registered
// when its module loads. With isolate: false that happens once per worker, in the first file, whose afterAll then
// clears the flag for every later file ("The current testing environment is not configured to support act(...)").
// Setup files run per test file, so set it here.
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  // Unmount first, while errorSpy is still active. Testing Library's own afterEach(cleanup) is registered when its
  // module loads, i.e. once per worker under isolate: false, so later files would keep the previous file's DOM.
  cleanup();
  // Snapshot both signals before restoreAllMocks() throws away the spy, and before the language/storage reset below
  // (which itself must run regardless, so the next test starts from a clean language/storage state).
  const errors = [...errorSpy.mock.calls];
  const unmocked = unmockedRequests.splice(0);
  vi.restoreAllMocks();
  // Reset the language before clearing storage: changeLanguage fires the "languageChanged" listener in
  // i18n/index.ts, which writes the language back to localStorage. Clearing first would leave that write
  // behind, so the next test would not see an empty localStorage.
  await i18n.changeLanguage("en");
  localStorage.clear();
  // MUI's cssVariables color scheme adds "light"/"dark" to <html>; with isolate: false that would leak into
  // the next test file's first render, which reads the class before any of its own mode changes happen.
  document.documentElement.classList.remove("light", "dark");
  const problems: string[] = [];
  if (errors.length > 0) {
    problems.push(`Unexpected console.error during test: ${errors[0].map((part) => String(part)).join(" ")}`);
  }
  if (unmocked.length > 0) {
    problems.push(`Unmocked requests during test: ${unmocked.join(", ")}`);
  }
  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
});
