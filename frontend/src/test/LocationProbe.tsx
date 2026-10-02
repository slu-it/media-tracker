import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { LOCATION_PROBE_LABEL } from "./currentLocation";

/**
 * Hidden `<output aria-label="location">` showing `pathname + search + hash` of the router location, so tests can
 * assert URL changes; `hidden` keeps it out of the accessibility tree, so it is found by label via
 * `currentLocation()` (src/test/currentLocation.ts).
 */
export function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  // Portalled to the body so `container` stays empty for "renders nothing" assertions.
  return createPortal(
    <output aria-label={LOCATION_PROBE_LABEL} hidden>
      {pathname + search + hash}
    </output>,
    document.body,
  );
}
