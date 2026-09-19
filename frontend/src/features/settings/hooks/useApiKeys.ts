import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../../api/client";
import type { ApiKeySlot, ApiKeysResponse } from "../../../types/api";
import { getApiKeys, regenerateApiKey } from "../api/settingsApi";

export interface ApiKeysState {
  keys: ApiKeysResponse | null;
  loading: boolean;
  error: string | null;
  /** The slot currently being regenerated, if any. */
  busySlot: ApiKeySlot | null;
  regenerate: (slot: ApiKeySlot) => Promise<void>;
  /** Refetches both keys, e.g. after the initial load failed. */
  reload: () => void;
}

/** Loads the user's API keys once on mount; `regenerate(slot)` replaces one key and refreshes both. */
export function useApiKeys(loadErrorText: string, regenerateErrorText: string): ApiKeysState {
  const [keys, setKeys] = useState<ApiKeysResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<ApiKeySlot | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getApiKeys()
      .then((data) => {
        if (!cancelled) {
          setKeys(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, loadErrorText));
      });
    return () => {
      cancelled = true;
    };
  }, [loadErrorText, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const regenerate = useCallback(
    async (slot: ApiKeySlot) => {
      setBusySlot(slot);
      setError(null);
      try {
        setKeys(await regenerateApiKey(slot));
      } catch (cause: unknown) {
        setError(errorMessage(cause, regenerateErrorText));
      } finally {
        setBusySlot(null);
      }
    },
    [regenerateErrorText],
  );

  return { keys, loading: keys === null && error === null, error, busySlot, regenerate, reload };
}
