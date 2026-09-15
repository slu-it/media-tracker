import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { AppProviders } from "../AppProviders";

/** `render` with the same theme/i18n providers as main.tsx. */
export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(<AppProviders>{ui}</AppProviders>);
}
