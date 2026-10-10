import { useMemo, useState, type ReactNode } from "react";
import { DataRevisionContext } from "../hooks/dataRevision";

/** Holds the data revision counter; the app shell keys the routed view with it so a bump reloads the view. */
export function DataRevisionProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const value = useMemo(() => ({ revision, bump: () => setRevision((n) => n + 1) }), [revision]);
  return <DataRevisionContext value={value}>{children}</DataRevisionContext>;
}
