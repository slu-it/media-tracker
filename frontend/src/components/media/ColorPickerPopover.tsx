import { useState } from "react";
import { Box, Button, ButtonBase, Popover, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { PALETTE_ENTRIES } from "../../domain/media/colorPalette";
import { normalizeHexColor, validateHexColor } from "../../domain/media/values";
import { ColorChip } from "./ColorChip";
import { HexColorField } from "./fields/HexColorField";

interface ColorPickerPopoverProps {
  /** The element the popover hangs from; it is open while this is set. */
  anchorEl: HTMLElement | null;
  /** The color the picker starts from (`RRGGBB`). */
  color: string;
  /** Text of the live preview chip. */
  previewLabel: string;
  onApply: (color: string) => void;
  onClose: () => void;
}

/** Popover to choose a color from the palette or by hex code. Mount it per open: the draft starts from `color`. */
export function ColorPickerPopover({ anchorEl, color, previewLabel, onApply, onClose }: ColorPickerPopoverProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(color);
  const valid = validateHexColor(draft) === null;
  const normalized = normalizeHexColor(draft);

  return (
    <Popover
      open={anchorEl !== null}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
    >
      <Stack spacing={1.5} sx={{ p: 2, width: 248 }}>
        <Box
          role="group"
          aria-label={t("media.coloredVocabulary.palette")}
          sx={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 0.5 }}
        >
          {PALETTE_ENTRIES.map(({ hex: swatch, nameKey }) => (
            <ButtonBase
              key={swatch}
              aria-label={t("media.coloredVocabulary.swatch", { name: t(nameKey), hex: swatch })}
              aria-pressed={valid && normalized === swatch}
              onClick={() => setDraft(swatch)}
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                bgcolor: `#${swatch}`,
                border: 2,
                borderColor: valid && normalized === swatch ? "text.primary" : "transparent",
              }}
            />
          ))}
        </Box>
        <HexColorField label={t("media.coloredVocabulary.hexColor")} value={draft} onChange={setDraft} showErrors />
        <Box aria-label={t("media.coloredVocabulary.preview")} role="group">
          <ColorChip item={{ id: "preview", label: previewLabel, associatedColor: valid ? normalized : color }} />
        </Box>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button onClick={onClose}>{t("media.coloredVocabulary.cancel")}</Button>
          <Button variant="contained" disabled={!valid} onClick={() => onApply(normalized)}>
            {t("media.coloredVocabulary.apply")}
          </Button>
        </Stack>
      </Stack>
    </Popover>
  );
}
