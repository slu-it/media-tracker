import { createContext, useContext } from "react";

export interface DataRevision {
  /** Changes whenever data was edited outside the routed view (e.g. in the settings dialog). */
  revision: number;
  /** Announces such a change; the routed view remounts and reloads. */
  bump: () => void;
}

export const DataRevisionContext = createContext<DataRevision>({ revision: 0, bump: () => {} });

export function useDataRevision(): DataRevision {
  return useContext(DataRevisionContext);
}
