import { DEFAULT_MEDIA_KIND, isMediaKind, type MediaKind } from "../components/layout/mediaKinds";
import { useLocalStorageState } from "./useLocalStorageState";

export const MEDIA_TAB_STORAGE_KEY = "mt.mediaTab";

/** The selected media tab, restored from the last visit. */
export function useStoredTab(): [MediaKind, (kind: MediaKind) => void] {
  return useLocalStorageState<MediaKind>(MEDIA_TAB_STORAGE_KEY, DEFAULT_MEDIA_KIND, isMediaKind);
}
