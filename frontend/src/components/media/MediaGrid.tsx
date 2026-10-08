import { Fragment, type ReactNode } from "react";
import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import { COVER_ASPECT_RATIO, coverHeight } from "../coverFrame";
import { CARD_COVER_WIDTH } from "./MediaCardShell";
import { SECTION_GAP } from "./mediaLayout";

interface MediaGridMessages {
  /** Shown when the list is empty and neither a search term nor a filter is active. */
  empty: string;
  noSearchResults: (term: string) => string;
  noFilterResults: string;
}

interface MediaGridProps<T extends { id: string }> {
  items: T[] | null;
  /** Number of skeleton cards to show while `items` is still null. */
  skeletons?: number;
  onOpen: (item: T) => void;
  /** Active search term, if any; switches the empty state to a search-specific message. */
  searchTerm?: string;
  /** Whether a filter is narrowing the list; see [searchTerm]. */
  filtered?: boolean;
  /** Card renderer. `onClick` already captures the item a click should open. */
  renderCard: (item: T, onClick: () => void) => ReactNode;
  messages: MediaGridMessages;
  /** Cover shape of the skeletons; defaults to the standard cover ratio. Pass the kind's ratio to match its cards. */
  coverAspectRatio?: number;
}

const GRID_SX = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 2,
  py: SECTION_GAP,
};

/** Responsive grid: as many columns as fit 200px cards. */
export function MediaGrid<T extends { id: string }>({
  items,
  skeletons = 8,
  onOpen,
  searchTerm,
  filtered,
  renderCard,
  messages,
  coverAspectRatio = COVER_ASPECT_RATIO,
}: MediaGridProps<T>) {
  if (items === null) {
    return (
      <Box sx={GRID_SX} aria-busy="true">
        {Array.from({ length: skeletons }, (_, i) => (
          <Card key={i} variant="outlined">
            <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <Skeleton
                variant="rounded"
                width={CARD_COVER_WIDTH}
                height={coverHeight(CARD_COVER_WIDTH, coverAspectRatio)}
              />
              <Skeleton width="70%" height="2.6em" />
              <Skeleton variant="rounded" width="50%" height={24} />
              {/* The icon row is conditional on the real card (a default-status item shows none), so its
                  height is not reserved here either; reserving it would make every skeleton taller than
                  most real cards instead of matching them. */}
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }
  if (items.length === 0) {
    // A search term wins over an active filter: it names the exact text the user typed, while the filter
    // message only says "the selected filters" without listing them, so it is the less specific of the two.
    const message = searchTerm
      ? messages.noSearchResults(searchTerm)
      : filtered
        ? messages.noFilterResults
        : messages.empty;
    return (
      <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
        {message}
      </Typography>
    );
  }
  return (
    <Box sx={GRID_SX}>
      {items.map((item) => (
        <Fragment key={item.id}>{renderCard(item, () => onOpen(item))}</Fragment>
      ))}
    </Box>
  );
}
