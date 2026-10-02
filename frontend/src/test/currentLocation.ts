import { screen } from "@testing-library/react";

/** Accessible label of the hidden router-location probe rendered by `renderWithProviders`. */
export const LOCATION_PROBE_LABEL = "location";

/** The current router location (`pathname + search + hash`) as rendered by the probe. */
export function currentLocation(): string | null {
  return screen.getByLabelText(LOCATION_PROBE_LABEL).textContent;
}
