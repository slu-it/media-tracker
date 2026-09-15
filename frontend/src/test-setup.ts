import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import i18n from "./i18n";

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

afterEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await i18n.changeLanguage("en");
});
