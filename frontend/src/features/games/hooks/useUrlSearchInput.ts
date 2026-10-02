import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

/**
 * Search box state kept in sync with the URL's `search` param (MT-032), shared by the overview and the watchlist.
 *
 * The input is local state (typing must not write the URL on every keystroke); it follows the URL when the URL
 * changes from outside (Back/Forward, a link). The debounced input is handed to `writeSearch`, which is
 * expected to replace the history entry and drop the page. Returns `[input, setInput, flush]`; `flush` applies
 * the pending debounce at once (Enter).
 */
export function useUrlSearchInput(
  urlSearch: string,
  writeSearch: (search: string) => void,
  debounceMs: number,
): [string, (value: string) => void, () => void] {
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, flushSearch] = useDebouncedValue(searchInput.trim(), debounceMs);

  // The value this hook last wrote to the URL. A URL change equal to it is our own write (the user may have typed
  // on since) and keeps the input; anything else (Back/Forward, a link) is external and is adopted.
  const lastWritten = useRef<string | null>(null);

  // Adjust state while rendering when the URL search changes.
  const [previousUrlSearch, setPreviousUrlSearch] = useState(urlSearch);
  if (urlSearch !== previousUrlSearch) {
    setPreviousUrlSearch(urlSearch);
    // Reading the ref here is deliberate: it only decides whether this URL change was our own write, and a state
    // copy would lag one render behind the write that caused the change.
    // eslint-disable-next-line react-hooks/refs
    if (urlSearch !== lastWritten.current) setSearchInput(urlSearch);
  }

  // Write only once the debounce has settled on the current input. After an external change the debounced value
  // is stale (it differs from the reset input) and is therefore not written back.
  useEffect(() => {
    if (debouncedSearch === searchInput.trim() && debouncedSearch !== urlSearch) {
      lastWritten.current = debouncedSearch;
      writeSearch(debouncedSearch);
    }
  }, [debouncedSearch, searchInput, urlSearch, writeSearch]);

  return [searchInput, setSearchInput, flushSearch];
}
