import { useLocation } from "react-router";
import { parseRoute, type ActiveRoute } from "../routes";

/** The media route the current location denotes, `undefined` while on an unknown path (about to be redirected). */
export function useActiveRoute(): ActiveRoute | undefined {
  const { pathname } = useLocation();
  return parseRoute(pathname);
}
