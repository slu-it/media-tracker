import { useState, type FormEvent } from "react";
import { Alert, Box, Button, ButtonBase, Stack, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ApiError, errorMessage } from "../../../api/client";
import { firstUnusedColor } from "../../../domain/media/colorPalette";
import { COLORED_LABEL_MAX_LENGTH, validateColoredLabel } from "../../../domain/media/values";
import { ColorPickerPopover } from "../ColorPickerPopover";
import type { ColoredVocabularyLabels } from "./coloredVocabulary";

interface AddColoredEntryFormProps {
  labels: ColoredVocabularyLabels;
  /** Colors of the existing entries; the initial color is the first palette color not among them. */
  usedColors: readonly string[];
  create: (label: string, color: string) => Promise<void>;
}

/** Name field, swatch and Add button below the list. */
export function AddColoredEntryForm({ labels, usedColors, create }: AddColoredEntryFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [chosenColor, setChosenColor] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const color = chosenColor ?? firstUnusedColor(usedColors);
  const code = validateColoredLabel(name);
  const showError = code !== null && touched;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (busy || code !== null) return;
    setBusy(true);
    setError(null);
    try {
      await create(name.trim(), color);
      setName("");
      setChosenColor(null);
      setTouched(false);
      setTaken(false);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 409 && cause.body?.error === "name_taken") {
        setTaken(true);
      } else {
        setError(errorMessage(cause, t("errors.saveFailed")));
      }
    } finally {
      setBusy(false);
    }
  };

  const helperText = taken
    ? t("media.coloredVocabulary.nameTaken")
    : showError
      ? t(`validation.${code}`, { max: COLORED_LABEL_MAX_LENGTH })
      : " ";

  return (
    <Box component="form" noValidate onSubmit={(event) => void submit(event)}>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        <ButtonBase
          aria-label={labels.newColor}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ width: 28, height: 28, mt: 1, flexShrink: 0, borderRadius: "50%", bgcolor: `#${color}` }}
        />
        <TextField
          fullWidth
          size="small"
          label={labels.addLabel}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setTaken(false);
          }}
          onBlur={() => {
            if (name !== "") setTouched(true);
          }}
          error={taken || showError}
          helperText={helperText}
          slotProps={{ htmlInput: { maxLength: COLORED_LABEL_MAX_LENGTH + 16, readOnly: busy, "aria-busy": busy } }}
        />
        <Button type="submit" variant="contained" sx={{ mt: 0.25, flexShrink: 0 }}>
          {t("media.coloredVocabulary.add")}
        </Button>
      </Stack>
      {anchor !== null && (
        <ColorPickerPopover
          anchorEl={anchor}
          color={color}
          previewLabel={name.trim() || labels.addLabel}
          onApply={(next) => {
            setChosenColor(next);
            setAnchor(null);
          }}
          onClose={() => setAnchor(null)}
        />
      )}
    </Box>
  );
}
