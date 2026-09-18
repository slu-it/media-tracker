import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi, type MockInstance } from "vitest";
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

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  // Snapshot both signals before restoreAllMocks() throws away the spy, and before the cleanup below
  // (which itself must run regardless, so the next test starts from a clean language/storage state).
  const errors = [...errorSpy.mock.calls];
  const unmocked = unmockedRequests.splice(0);
  vi.restoreAllMocks();
  // Reset the language before clearing storage: changeLanguage fires the "languageChanged" listener in
  // i18n/index.ts, which writes the language back to localStorage. Clearing first would leave that write
  // behind, so the next test would not see an empty localStorage.
  await i18n.changeLanguage("en");
  localStorage.clear();
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
