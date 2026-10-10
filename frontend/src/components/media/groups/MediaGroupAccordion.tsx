import { useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Typography } from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../../api/client";
import { useGroupItems } from "../../../hooks/useGroupItems";
import { ConfirmDialog } from "../../dialog/ConfirmDialog";
import { MediaGrid } from "../MediaGrid";
import { SECTION_GAP } from "../mediaLayout";
import { RenameGroupDialog } from "./RenameGroupDialog";
import type { GroupLabels, LoadGroupItems, MediaGroup, RenderGroupCard } from "../../../domain/media/groups";

const MAX_SKELETONS = 8;

interface MediaGroupAccordionProps<T extends { id: string }> {
  group: MediaGroup;
  /** Must be a stable, module-level function (see `useGroupItems`). */
  loadItems: LoadGroupItems<T>;
  renderCard: RenderGroupCard<T>;
  coverAspectRatio: number;
  labels: GroupLabels;
  expanded: boolean;
  onToggle: (groupId: string, expanded: boolean) => void;
  /** Bumped after a save anywhere, so an open section refetches. */
  reloadToken: number;
  onOpen: (item: T) => void;
  /** Renames the group; rejects with an `ApiError` 409 `name_taken` when another group has the name. */
  onRename: (groupId: string, name: string) => Promise<void>;
  /** Merges the group into `targetId`. */
  onMerge: (groupId: string, targetId: string) => Promise<void>;
  /** Deletes the group; only offered while it has no items. */
  onDelete: (groupId: string) => Promise<void>;
}

/** One group: name and item count in the summary; the items are loaded when the section is expanded. */
export function MediaGroupAccordion<T extends { id: string }>({
  group,
  loadItems,
  renderCard,
  coverAspectRatio,
  labels,
  expanded,
  onToggle,
  reloadToken,
  onOpen,
  onRename,
  onMerge,
  onDelete,
}: MediaGroupAccordionProps<T>) {
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
          <Chip size="small" label={labels.itemCount(group.itemCount)} />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <GroupToolbar group={group} labels={labels} onRename={onRename} onMerge={onMerge} onDelete={onDelete} />
        {group.itemCount === 0 ? (
          <Typography color="text.secondary">{labels.noItems}</Typography>
        ) : (
          <GroupItems
            group={group}
            loadItems={loadItems}
            renderCard={renderCard}
            coverAspectRatio={coverAspectRatio}
            noItems={labels.noItems}
            reloadToken={reloadToken}
            onOpen={onOpen}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
}

/** Edit (always) and delete (only without items) for the group, right-aligned at the top of the expanded section. */
function GroupToolbar({
  group,
  labels,
  onRename,
  onMerge,
  onDelete,
}: Pick<MediaGroupAccordionProps<{ id: string }>, "group" | "labels" | "onRename" | "onMerge" | "onDelete">) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editLabel = labels.editLabel(group.name);
  const deleteLabel = labels.deleteLabel(group.name);

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
        {group.itemCount === 0 && (
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
          labels={labels}
          onRename={(name) => onRename(group.id, name)}
          onMerge={(targetId) => onMerge(group.id, targetId)}
          onClose={() => setRenaming(false)}
        />
      )}
      <ConfirmDialog
        open={confirming}
        question={labels.deleteQuestion(group.name)}
        onDecision={(confirmed) => void decide(confirmed)}
        destructive
      />
    </>
  );
}

function GroupItems<T extends { id: string }>({
  group,
  loadItems,
  renderCard,
  coverAspectRatio,
  noItems,
  reloadToken,
  onOpen,
}: Pick<
  MediaGroupAccordionProps<T>,
  "group" | "loadItems" | "renderCard" | "coverAspectRatio" | "reloadToken" | "onOpen"
> & { noItems: string }) {
  const { t } = useTranslation();
  const { items, error, reload } = useGroupItems(group.id, loadItems, reloadToken, t("errors.loadFailed"));
  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: SECTION_GAP }} action={<Button onClick={reload}>{t("common.retry")}</Button>}>
          {error}
        </Alert>
      )}
      <MediaGrid
        items={items}
        skeletons={Math.min(group.itemCount, MAX_SKELETONS)}
        onOpen={onOpen}
        renderCard={(item, onClick) => renderCard(item, onClick, group)}
        coverAspectRatio={coverAspectRatio}
        messages={{ empty: noItems, noSearchResults: () => noItems, noFilterResults: noItems }}
      />
    </>
  );
}
