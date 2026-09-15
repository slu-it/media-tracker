import type { ErrorResponse } from "../types/api";

/** Thrown for any non-2xx response that is not a 401 (401s redirect to /login instead). */
export class ApiError extends Error {
  readonly status: number;
  /** The parsed error body, when the backend sent one. */
  readonly body: ErrorResponse | undefined;

  constructor(status: number, message: string, body?: ErrorResponse) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const LOGIN_PATH = "/login";

/**
 * Typed fetch wrapper for the backend's /api routes.
 * The session cookie is sent automatically (same origin, also under the Vite dev proxy).
 * A 401 means the session is missing or expired: the browser is sent to the login page.
 * A 204 or empty body resolves to `undefined` (callers type such endpoints as `Promise<void>`).
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
    const body = parseErrorBody(text);
    throw new ApiError(response.status, body?.message ?? body?.error ?? text ?? response.statusText, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function parseErrorBody(text: string): ErrorResponse | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && typeof (parsed as ErrorResponse).error === "string") {
      return parsed as ErrorResponse;
    }
  } catch {
    // not JSON
  }
  return undefined;
}

/** Message to show a user for a failed API call; `fallback` when the error carries nothing readable. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.body?.message ?? fallback;
  return fallback;
}
