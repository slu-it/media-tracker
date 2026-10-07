import { createContext, useContext } from "react";

/** How long the search box waits after the last keystroke before firing a request. */
export const SEARCH_DEBOUNCE_MS = 500;

/**
 * Debounce delay for search boxes and suggestions. The app has no provider, so production uses
 * `SEARCH_DEBOUNCE_MS`; tests set a shorter delay via `renderWithProviders`.
 */
export const SearchDebounceContext = createContext(SEARCH_DEBOUNCE_MS);

export function useSearchDebounceMs(): number {
  return useContext(SearchDebounceContext);
}
