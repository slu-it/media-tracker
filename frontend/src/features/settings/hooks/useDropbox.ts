import { useCallback, useEffect, useState } from "react";
import type { DropboxStatusResponse } from "../../../types/api";
import { connectDropbox, disconnectDropbox, getAuthorizeUrl, getDropboxStatus } from "../api/dropboxApi";

export interface DropboxState {
  status: DropboxStatusResponse | null;
  /**
   * The raw cause of a failed status load, or `null`. Translated at render time (with `errorMessage`) instead of
   * inside this hook, so a language change does not depend on any effect here and cannot trigger a refetch.
   */
  error: unknown;
  loading: boolean;
  /** Re-fetches the status; used after a 503 `dropbox_unavailable` elsewhere revealed the connection was revoked. */
  reload: () => void;
  /**
   * The one-time authorize URL, fetched as soon as the status says available and not connected (so "Open Dropbox"
   * is a real link from the start, not a click-then-fetch-then-`window.open`); `null` while loading or on failure.
   */
  authorizeUrl: string | null;
  openError: unknown;
  connecting: boolean;
  connectError: unknown;
  /** Exchanges the pasted code; returns whether it succeeded, so the caller can clear the field only then. */
  connect: (code: string) => Promise<boolean>;
  disconnecting: boolean;
  disconnectError: unknown;
  disconnect: () => Promise<void>;
}

/**
 * Loads the Dropbox connection status once on mount (`reload()` refetches it), and offers the connect/disconnect
 * actions plus the in-app authorization URL. Each action keeps its own busy/error state, in the style of
 * `useApiKeys`. Every effect here depends only on stable values (`needsAuthorizeUrl`, the reload token), never on
 * translated strings: the caller renders the stored raw causes with `errorMessage`, so switching the UI language
 * neither resets this state nor refetches anything.
 */
export function useDropbox(): DropboxState {
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<DropboxStatusResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<unknown>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    getDropboxStatus()
      .then((data) => {
        if (!cancelled) {
          setStatus(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const needsAuthorizeUrl = status !== null && status.available && !status.connected;

  useEffect(() => {
    if (!needsAuthorizeUrl) return;
    let cancelled = false;
    getAuthorizeUrl()
      .then(({ url }) => {
        if (!cancelled) {
          setAuthorizeUrl(url);
          setOpenError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setOpenError(cause);
      });
    return () => {
      cancelled = true;
      // Runs as soon as the status stops needing it (connected, or the whole section unmounts), so a later
      // disconnect starts a fresh fetch instead of showing this session's now possibly stale/used-up URL.
      setAuthorizeUrl(null);
      setOpenError(null);
    };
  }, [needsAuthorizeUrl]);

  const connect = useCallback(async (code: string) => {
    setConnecting(true);
    setConnectError(null);
    try {
      setStatus(await connectDropbox(code));
      return true;
    } catch (cause: unknown) {
      setConnectError(cause);
      return false;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      await disconnectDropbox();
      setStatus((current) => (current ? { ...current, connected: false, connectedAt: null } : current));
    } catch (cause: unknown) {
      setDisconnectError(cause);
    } finally {
      setDisconnecting(false);
    }
  }, []);

  return {
    status,
    loading: status === null && error === null,
    error,
    reload,
    authorizeUrl,
    openError,
    connecting,
    connectError,
    connect,
    disconnecting,
    disconnectError,
    disconnect,
  };
}
