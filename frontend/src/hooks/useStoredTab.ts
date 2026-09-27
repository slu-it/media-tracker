import { DEFAULT_MEDIA_KIND, MEDIA_KINDS, type MediaKind } from "../components/layout/mediaKinds";
import { useStoredChoice } from "./useStoredChoice";

export const MEDIA_TAB_STORAGE_KEY = "mt.mediaTab";

/** The selected media tab, restored from the last visit. */
export function useStoredTab(): [MediaKind, (kind: MediaKind) => void] {
  return useStoredChoice<MediaKind>(MEDIA_TAB_STORAGE_KEY, MEDIA_KINDS, DEFAULT_MEDIA_KIND);
}
