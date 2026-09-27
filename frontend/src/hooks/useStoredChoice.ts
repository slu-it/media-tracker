import { useLocalStorageState } from "./useLocalStorageState";

/**
 * `useLocalStorageState` restricted to one of `allowed`, deriving the `isValid` guard from the array instead of
 * a hand-written type predicate. Use for any small set of persisted string choices (the media tab, a media
 * kind's sub-pages, ...).
 */
export function useStoredChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const isValid = (raw: string): raw is T => (allowed as readonly string[]).includes(raw);
  return useLocalStorageState<T>(key, fallback, isValid);
}
