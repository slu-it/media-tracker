import type { ReactElement } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslation } from "react-i18next";
import type { BookResponse } from "../../../types/api";
import { MediaGrid } from "../../../components/media/MediaGrid";
import { SECTION_GAP } from "../../../components/media/mediaLayout";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";
import { useGroupBooks } from "../hooks/useGroupBooks";

const MAX_SKELETONS = 8;

/** A series or an author with its book count. */
export interface BookGroup {
  id: string;
  name: string;
  bookCount: number;
}

/** The i18n namespace holding the texts of a grouping (`bookCount`, `noBooks`, ...). */
export type BookGroupLabelPrefix = "books.seriesView" | "books.authorsView";

export type LoadGroupBooks = (id: string, signal: AbortSignal) => Promise<BookResponse[]>;
export type RenderGroupCard = (book: BookResponse, onClick: () => void, group: BookGroup) => ReactElement;

interface BookGroupAccordionProps {
  group: BookGroup;
  /** Must be a stable, module-level function (see `useGroupBooks`). */
  loadBooks: LoadGroupBooks;
  renderCard: RenderGroupCard;
  labelPrefix: BookGroupLabelPrefix;
  expanded: boolean;
  onToggle: (groupId: string, expanded: boolean) => void;
  /** Bumped after a save anywhere, so an open section refetches. */
  reloadToken: number;
  onOpen: (book: BookResponse) => void;
}

/** One group: name and book count in the summary; the books are loaded when the section is expanded. */
export function BookGroupAccordion({
  group,
  loadBooks,
  renderCard,
  labelPrefix,
  expanded,
  onToggle,
  reloadToken,
  onOpen,
}: BookGroupAccordionProps) {
  const { t } = useTranslation();
  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => onToggle(group.id, isExpanded)}
      slotProps={{ transition: { unmountOnExit: true }, heading: { component: "h2" } }}
      disableGutters
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography component="span" variant="subtitle1">
            {group.name}
          </Typography>
          <Chip size="small" label={t(`${labelPrefix}.bookCount`, { count: group.bookCount })} />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {group.bookCount === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
            {t(`${labelPrefix}.noBooks`)}
          </Typography>
        ) : (
          <GroupBooks
            group={group}
            loadBooks={loadBooks}
            renderCard={renderCard}
            labelPrefix={labelPrefix}
            reloadToken={reloadToken}
            onOpen={onOpen}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
}

function GroupBooks({
  group,
  loadBooks,
  renderCard,
  labelPrefix,
  reloadToken,
  onOpen,
}: Pick<BookGroupAccordionProps, "group" | "loadBooks" | "renderCard" | "labelPrefix" | "reloadToken" | "onOpen">) {
  const { t } = useTranslation();
  const { books, error, reload } = useGroupBooks(group.id, loadBooks, reloadToken, t("errors.loadFailed"));
  const noBooks = t(`${labelPrefix}.noBooks`);
  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: SECTION_GAP }} action={<Button onClick={reload}>{t("common.retry")}</Button>}>
          {error}
        </Alert>
      )}
      <MediaGrid
        items={books}
        skeletons={Math.min(group.bookCount, MAX_SKELETONS)}
        onOpen={onOpen}
        renderCard={(book, onClick) => renderCard(book, onClick, group)}
        coverAspectRatio={BOOK_COVER_ASPECT_RATIO}
        messages={{ empty: noBooks, noSearchResults: () => noBooks, noFilterResults: noBooks }}
      />
    </>
  );
}
