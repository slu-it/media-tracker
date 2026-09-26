import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../api/client";
import type { StoredFileDto } from "../../../types/api";
import { backupToDropboxNow, getCloudBackup } from "../api/backupApi";

export interface CloudBackupState {
  lastBackup: StoredFileDto | null;
  loading: boolean;
  /** The raw cause of a failed load, or `null`. Translated at render time, see [isDropboxError]. */
  error: unknown;
  backingUp: boolean;
  /** The raw cause of a failed `backupNow()`, or `null`. Translated at render time, see [isDropboxError]. */
  backupError: unknown;
  /** A 503 `dropbox_unavailable` from the initial load or `backupNow()`; shown as its own message. */
  unavailable: boolean;
  backupNow: () => Promise<void>;
}

function isDropboxUnavailable(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === 503 && cause.body?.error === "dropbox_unavailable";
}

/**
 * Whether [cause] is a 502 `dropbox_error` (Dropbox itself rejected the call): the caller shows a fixed,
 * translated message instead of the backend's fixed, developer-facing one. Exported so the host component can
 * pick the right translated text for [CloudBackupState.error]/[CloudBackupState.backupError] at render time,
 * without this hook needing to know any translated string itself.
 */
export function isDropboxError(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === 502 && cause.body?.error === "dropbox_error";
}

/**
 * Loads the last Dropbox backup while `enabled` (the host gates this on being connected, so a disconnected user
 * never issues the request) and offers `backupNow()`, in the style of `useExportImport`. `onUnavailable` is
 * called whenever the backend reports the connection gone (503 `dropbox_unavailable`), so the host can refresh
 * the Dropbox status and fall back to "not connected". Every effect here depends only on `enabled` and
 * `onUnavailable` (expected to be a stable callback), never on translated strings, so a language change neither
 * resets this state nor re-issues any request.
 */
export function useCloudBackup(enabled: boolean, onUnavailable: () => void): CloudBackupState {
  const [lastBackup, setLastBackup] = useState<StoredFileDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getCloudBackup()
      .then((data) => {
        if (!cancelled) {
          setLastBackup(data.lastBackup);
          setLoaded(true);
          setError(null);
          setUnavailable(false);
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoaded(true);
        if (isDropboxUnavailable(cause)) {
          setUnavailable(true);
          onUnavailable();
        } else {
          setUnavailable(false);
          setError(cause);
        }
      });
    return () => {
      cancelled = true;
      // Runs as soon as `enabled` turns false again (disconnect), so a later reconnect starts from the loading
      // state instead of showing this session's stale `lastBackup`/error while the new fetch is in flight.
      setLastBackup(null);
      setLoaded(false);
      setError(null);
      setUnavailable(false);
    };
  }, [enabled, onUnavailable]);

  const backupNow = useCallback(async () => {
    setBackingUp(true);
    setBackupError(null);
    try {
      setLastBackup((await backupToDropboxNow()).lastBackup);
      setUnavailable(false);
    } catch (cause: unknown) {
      if (isDropboxUnavailable(cause)) {
        setUnavailable(true);
        onUnavailable();
      } else {
        setBackupError(cause);
      }
    } finally {
      setBackingUp(false);
    }
  }, [onUnavailable]);

  return {
    lastBackup,
    loading: enabled && !loaded,
    error,
    backingUp,
    backupError,
    unavailable,
    backupNow,
  };
}
