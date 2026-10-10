import { useRef, useState } from "react";
import { Box, ButtonBase, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import { useTranslation } from "react-i18next";
import { ApiError, errorMessage } from "../../../api/client";
import { COLORED_LABEL_MAX_LENGTH, validateColoredLabel } from "../../../domain/media/values";
import { ConfirmDialog } from "../../dialog/ConfirmDialog";
import { ColorChip } from "../ColorChip";
import { ColorPickerPopover } from "../ColorPickerPopover";
import type { ColoredEntry, ColoredEntryUpdate, ColoredVocabularyLabels } from "./coloredVocabulary";

interface ColoredVocabularyRowProps {
  entry: ColoredEntry;
  labels: ColoredVocabularyLabels;
  /** Rejects with an `ApiError` (409 `name_taken` for a rename onto an existing name). */
  update: (id: string, changes: ColoredEntryUpdate) => Promise<void>;
  /** Deletes the entry; the editor handles failures itself. */
  remove: (id: string) => Promise<void>;
}

/** One entry: swatch (opens the color picker), name (inline rename), color chip preview, usage count and delete. */
export function ColoredVocabularyRow({ entry, labels, update, remove }: ColoredVocabularyRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.label);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setDraft(entry.label);
    setNameError(null);
    setEditing(true);
  };
  const cancelEditing = () => {
    setEditing(false);
    setNameError(null);
  };

  const saveName = async () => {
    if (busy) return;
    const trimmed = draft.trim();
    if (trimmed === entry.label) {
      cancelEditing();
      return;
    }
    const code = validateColoredLabel(draft);
    if (code !== null) {
      setNameError(t(`validation.${code}`, { max: COLORED_LABEL_MAX_LENGTH }));
      return;
    }
    setBusy(true);
    try {
      await update(entry.id, { label: trimmed });
      setEditing(false);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 409 && cause.body?.error === "name_taken") {
        setNameError(t("media.coloredVocabulary.nameTaken"));
      } else {
        setNameError(errorMessage(cause, t("errors.saveFailed")));
      }
    } finally {
      setBusy(false);
      // The field stays focused while saving (read-only, not disabled); make sure of it after a failure.
      inputRef.current?.focus();
    }
  };

  const applyColor = async (color: string) => {
    setColorAnchor(null);
    if (color === entry.associatedColor) return;
    try {
      await update(entry.id, { associatedColor: color });
    } catch {
      // The editor reports failed updates itself.
    }
  };

  const inUse = entry.count > 0;

  return (
    <Box
      sx={{
        display: "grid",
        alignItems: "center",
        columnGap: 1,
        rowGap: 0.5,
        py: 0.5,
        gridTemplateColumns: { xs: "auto minmax(0, 1fr) auto", sm: "auto minmax(0, 1fr) auto auto" },
        gridTemplateAreas: {
          xs: '"swatch name delete" ". meta meta"',
          sm: '"swatch name meta delete"',
        },
      }}
    >
      <ButtonBase
        aria-label={labels.changeColor(entry.label)}
        onClick={(event) => setColorAnchor(event.currentTarget)}
        sx={{ gridArea: "swatch", width: 28, height: 28, borderRadius: "50%", bgcolor: `#${entry.associatedColor}` }}
      />
      <Box sx={{ gridArea: "name", minWidth: 0 }}>
        {editing ? (
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setNameError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveName();
              } else if (event.key === "Escape") {
                event.stopPropagation();
                cancelEditing();
              }
            }}
            onBlur={() => {
              if (!busy) cancelEditing();
            }}
            error={nameError !== null}
            helperText={nameError ?? undefined}
            slotProps={{
              htmlInput: {
                "aria-label": labels.editName(entry.label),
                "aria-busy": busy,
                readOnly: busy,
                maxLength: COLORED_LABEL_MAX_LENGTH + 16,
              },
            }}
            inputRef={inputRef}
          />
        ) : (
          <ButtonBase
            aria-label={labels.editName(entry.label)}
            onClick={startEditing}
            sx={{ display: "block", maxWidth: "100%", textAlign: "left", borderRadius: 0.5 }}
          >
            <Typography noWrap>{entry.label}</Typography>
          </ButtonBase>
        )}
      </Box>
      <Box sx={{ gridArea: "meta", display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <ColorChip item={entry} />
        <Typography variant="body2" color="text.secondary" noWrap>
          {labels.count(entry.count)}
        </Typography>
      </Box>
      <Tooltip title={inUse ? labels.deleteInUse : ""}>
        <Box component="span" tabIndex={inUse ? 0 : undefined} sx={{ gridArea: "delete" }}>
          <IconButton aria-label={labels.deleteLabel(entry.label)} disabled={inUse} onClick={() => setConfirming(true)}>
            <DeleteOutlined />
          </IconButton>
        </Box>
      </Tooltip>
      {colorAnchor !== null && (
        <ColorPickerPopover
          anchorEl={colorAnchor}
          color={entry.associatedColor}
          previewLabel={entry.label}
          onApply={(color) => void applyColor(color)}
          onClose={() => setColorAnchor(null)}
        />
      )}
      <ConfirmDialog
        open={confirming}
        question={labels.deleteQuestion(entry.label)}
        destructive
        focusCancel
        confirmLabel={t("media.coloredVocabulary.delete")}
        cancelLabel={t("media.coloredVocabulary.cancel")}
        onDecision={(confirmed) => {
          setConfirming(false);
          if (confirmed) void remove(entry.id);
        }}
      />
    </Box>
  );
}
