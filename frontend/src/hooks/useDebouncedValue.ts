import { useEffect, useState } from "react";

/**
 * Returns `value` delayed by `delayMs`: the first render adopts it immediately, later changes only take
 * effect once `value` has stayed the same for `delayMs`. The returned `flush` applies the latest `value`
 * right away (e.g. on Enter), bypassing the remaining delay; given an argument it applies that value instead
 * (a caller that sets `value` and flushes in the same handler would otherwise flush the stale render's value).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): [T, (next?: T) => void] {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  const flush = (next: T = value) => setDebounced(next);

  return [debounced, flush];
}
