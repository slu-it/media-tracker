import { useState, type ReactElement } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Typography } from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { ConfirmDialog } from "../../../components/dialog/ConfirmDialog";
import type { BookResponse } from "../../../types/api";
import { MediaGrid } from "../../../components/media/MediaGrid";
import { SECTION_GAP } from "../../../components/media/mediaLayout";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";
import { useGroupBooks } from "../hooks/useGroupBooks";
import { RenameGroupDialog } from "./RenameGroupDialog";

const MAX_SKELETONS = 8;

/** A series or an author with its book count. */
export interface BookGroup {
  id: string;
  name: string;
  bookCount: number;
}

/** The i18n namespace holding the texts of a grouping (`bookCount`, `deleteLabel`, ...). */
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
  /** Renames the group; rejects with an `ApiError` 409 `name_taken` when another group has the name. */
  onRename: (groupId: string, name: string) => Promise<void>;
  /** Merges the group into `targetId`. */
  onMerge: (groupId: string, targetId: string) => Promise<void>;
  /** Deletes the group; only offered while it has no books. */
  onDelete: (groupId: string) => Promise<void>;
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
  onRename,
  onMerge,
  onDelete,
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
        <GroupToolbar
          group={group}
          labelPrefix={labelPrefix}
          onRename={onRename}
          onMerge={onMerge}
          onDelete={onDelete}
        />
        {group.bookCount === 0 ? (
          <Typography color="text.secondary">{t(`${labelPrefix}.noBooks`)}</Typography>
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

/** Edit (always) and delete (only without books) for the group, right-aligned at the top of the expanded section. */
function GroupToolbar({
  group,
  labelPrefix,
  onRename,
  onMerge,
  onDelete,
}: Pick<BookGroupAccordionProps, "group" | "labelPrefix" | "onRename" | "onMerge" | "onDelete">) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editLabel = t(`${labelPrefix}.editLabel`, { name: group.name });
  const deleteLabel = t(`${labelPrefix}.deleteLabel`, { name: group.name });

  const decide = async (confirmed: boolean) => {
    setConfirming(false);
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(group.id);
    } catch (cause: unknown) {
      setError(errorMessage(cause, t("errors.deleteFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: -0.5, mb: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<EditOutlinedIcon />}
          aria-label={editLabel}
          disabled={busy}
          onClick={() => setRenaming(true)}
        >
          {t("common.rename")}
        </Button>
        {group.bookCount === 0 && (
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteOutlinedIcon />}
            aria-label={deleteLabel}
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {t("common.delete")}
          </Button>
        )}
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      {renaming && (
        <RenameGroupDialog
          group={group}
          labelPrefix={labelPrefix}
          onRename={(name) => onRename(group.id, name)}
          onMerge={(targetId) => onMerge(group.id, targetId)}
          onClose={() => setRenaming(false)}
        />
      )}
      <ConfirmDialog
        open={confirming}
        question={t(`${labelPrefix}.deleteQuestion`, { name: group.name })}
        onDecision={(confirmed) => void decide(confirmed)}
        destructive
      />
    </>
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
