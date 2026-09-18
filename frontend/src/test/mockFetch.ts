import { vi } from "vitest";

export interface RecordedCall {
  method: string;
  /** Path and query, e.g. `/api/games?page=2&pageSize=50`. */
  url: string;
  body: unknown;
}

export type RouteHandler = (call: RecordedCall, url: URL) => Response | Promise<Response>;

/** Requests that matched no route during the current test; test-setup.ts fails the test on these. */
export const unmockedRequests: string[] = [];

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Replaces `fetch` with a router keyed by `"METHOD /path"`; `:id` matches one path segment
 * (`"PATCH /api/games/:id"`). Returns the recorded calls for assertions. A request that matches no route
 * throws instead of resolving, so a forgotten mock fails loudly rather than looking like a 404 response;
 * it is also recorded in {@link unmockedRequests} so test-setup.ts can fail the test even when the
 * component under test swallows the rejection (e.g. shows an error alert instead of rethrowing).
 */
export function mockApi(routes: Record<string, RouteHandler>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    const call: RecordedCall = { method, url: url.pathname + url.search, body };
    calls.push(call);
    const handler = Object.entries(routes).find(([key]) => matches(key, method, url.pathname))?.[1];
    if (!handler) {
      unmockedRequests.push(`${method} ${url.pathname}${url.search}`);
      throw new Error(`Unmocked request: ${method} ${url.pathname}${url.search}`);
    }
    return handler(call, url);
  });
  return calls;
}

function matches(key: string, method: string, pathname: string): boolean {
  const [keyMethod, keyPath] = key.split(" ");
  if (keyMethod !== method) return false;
  const pattern = "^" + keyPath.replace(/:[^/]+/g, "[^/]+") + "$";
  return new RegExp(pattern).test(pathname);
}
