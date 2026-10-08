import { useCallback, useEffect, useRef } from "react";
import { useLocation, useSearchParams, type NavigateOptions } from "react-router";

/**
 * The URL query of a view plus a robust writer (MT-032). React Router's functional `setSearchParams(prev => ...)`
 * hands `prev` the params of the last render, not the latest write, so two writes within one commit (e.g. the
 * debounced search write and a page correction) would overwrite each other. This hook keeps the latest written
 * params in a ref and applies every update on top of it; the ref is reset on every location change.
 */
export function useViewParams(): [
  URLSearchParams,
  (update: (prev: URLSearchParams) => URLSearchParams, options?: NavigateOptions) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const { key } = useLocation();
  const latest = useRef(searchParams);

  // Every navigation (new location key) starts from the URL the router reports now, even when the query is equal.
  useEffect(() => {
    latest.current = searchParams;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const write = useCallback(
    (update: (prev: URLSearchParams) => URLSearchParams, options?: NavigateOptions) => {
      const next = update(latest.current);
      latest.current = next;
      setSearchParams(next, options);
    },
    [setSearchParams],
  );

  return [searchParams, write];
}
