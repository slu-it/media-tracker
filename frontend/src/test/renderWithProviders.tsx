import type { ReactElement, ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppProviders } from "../AppProviders";
import { LocationProbe } from "./LocationProbe";

/**
 * `render` with the same theme/i18n/date-picker providers as main.tsx inside a `MemoryRouter` starting at `route`
 * (default `/`), applied via the `wrapper` option so `rerender` (e.g. reopening a dialog) keeps them too instead
 * of replacing the whole tree.
 */
export function renderWithProviders(ui: ReactElement, { route = "/" }: { route?: string } = {}): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AppProviders>
          {children}
          <LocationProbe />
        </AppProviders>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
