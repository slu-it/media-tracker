import { act } from "react";

/**
 * Waits one macrotask turn (`setTimeout(0)`) inside `act`, so microtasks and already-due timers (resolved fetch
 * mocks, MUI Transition timeouts) land their state updates inside an act scope. Use this instead of a bare
 * `setTimeout` await in React tests: outside `act` such an update logs a console.error and fails the test, and
 * on a slow CI runner the MUI Fade timer hits that gap.
 */
export async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
