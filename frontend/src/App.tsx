import { useEffect, useState } from "react";
import { ApiError, fetchMe } from "./api/client";
import type { MeResponse } from "./types/api";

type State = { status: "loading" } | { status: "ready"; me: MeResponse } | { status: "error"; message: string };

export function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setState({ status: "ready", me });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? `${error.status} ${error.message}` : String(error);
        setState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-shell">
      <header className="mt-header">
        <h1>Media Tracker</h1>
        {state.status === "ready" && (
          <div className="mt-user">
            <span>
              Signed in as <strong>{state.me.username}</strong>
            </span>
            {/* Plain form POST: the backend clears the session cookie and redirects to /login. */}
            <form method="post" action="/logout">
              <button type="submit">Log out</button>
            </form>
          </div>
        )}
      </header>
      <main>
        {state.status === "loading" && <p className="mt-empty">Loading…</p>}
        {state.status === "error" && <p className="mt-empty">Could not load your profile: {state.message}</p>}
        {state.status === "ready" && (
          <p className="mt-empty">No media lists yet. The lists and items features arrive in the next phase.</p>
        )}
      </main>
    </div>
  );
}
