import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { AppProviders } from "../AppProviders";

/**
 * `render` with the same theme/i18n/date-picker providers as main.tsx, applied via the `wrapper` option so
 * `rerender` (e.g. reopening a dialog) keeps them too instead of replacing the whole tree.
 */
export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(ui, { wrapper: AppProviders });
}
