import { useCallback, useState } from "react";

/**
 * `useState` whose value survives reloads in localStorage. Only string unions are supported: `isValid` guards
 * against stale or foreign values in storage, and storage failures (private mode) fall back to plain state.
 */
export function useLocalStorageState<T extends string>(
  key: string,
  fallback: T,
  isValid: (raw: string) => raw is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null && isValid(raw) ? raw : fallback;
    } catch {
      return fallback;
    }
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Storage unavailable: the value still applies for this session.
      }
    },
    [key],
  );

  return [value, set];
}
