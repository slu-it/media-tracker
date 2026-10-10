import { useTranslation } from "react-i18next";
import { MediaGroupsView } from "../../components/media/groups/MediaGroupsView";
import type { MediaGroup, RenderGroupCard } from "../../domain/media/groups";
import type { BookResponse } from "../../types/api";
import { BookDialogsHost } from "./components/BookDialogsHost";
import { BOOK_COVER_ASPECT_RATIO } from "./domain/bookValues";
import { useBookGroupLabels, type BookGroupLabelPrefix } from "./hooks/useBookGroupLabels";
import { useBooksMeta } from "./hooks/useBooksMeta";

interface BookGroupsViewProps {
  /** Must be stable, module-level functions (`useLoadOnce`, `useGroupItems`). */
  loadSummaries: () => Promise<MediaGroup[]>;
  loadBooks: (id: string, signal: AbortSignal) => Promise<BookResponse[]>;
  renderCard: RenderGroupCard<BookResponse>;
  deleteGroup: (id: string) => Promise<void>;
  renameGroup: (id: string, name: string) => Promise<unknown>;
  mergeGroup: (id: string, targetId: string) => Promise<unknown>;
  labelPrefix: BookGroupLabelPrefix;
}

/** The books flavour of `MediaGroupsView`: `BookDialogsHost`, the book cover ratio and the book texts. */
export function BookGroupsView({ loadBooks, labelPrefix, ...rest }: BookGroupsViewProps) {
  const { t } = useTranslation();
  const labels = useBookGroupLabels(labelPrefix);
  const { meta, reload: reloadMeta } = useBooksMeta(t("errors.loadFailed"));
  return (
    <MediaGroupsView
      {...rest}
      loadItems={loadBooks}
      coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
      labels={labels}
      onRefresh={reloadMeta}
      renderDialogs={({ selected, onSelect, refresh, onDeleted }) => (
        <BookDialogsHost
          selected={selected}
          onSelect={onSelect}
          onCreated={refresh}
          onUpdated={refresh}
          onDeleted={onDeleted}
          typeCounts={meta?.typeCounts}
        />
      )}
    />
  );
}
