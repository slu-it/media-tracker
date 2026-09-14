import type { MeResponse } from "../types/api";

/** Thrown for any non-2xx response that is not a 401 (401s redirect to /login instead). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const LOGIN_PATH = "/login";

/**
 * Typed fetch wrapper for the backend's /api routes.
 * The session cookie is sent automatically (same origin, also under the Vite dev proxy).
 * A 401 means the session is missing or expired: the browser is sent to the login page.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  if (response.status === 401) {
    window.location.assign(LOGIN_PATH);
    // Never resolves: navigation is in progress.
    return new Promise<T>(() => {});
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(response.status, text || response.statusText);
  }

  return (await response.json()) as T;
}

export function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/me");
}
