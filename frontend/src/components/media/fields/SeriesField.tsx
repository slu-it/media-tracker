import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { SeriesDraft } from "../../../domain/media/seriesDraft";
import { isExistingEntry, type NamedEntry, type VocabularyDraft } from "../../../domain/media/vocabularyDraft";
import { SeriesPositionField } from "./SeriesPositionField";
import { VocabularyField } from "./VocabularyField";

interface SeriesFieldProps {
  value: SeriesDraft[];
  onChange: (value: SeriesDraft[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
  /** Stable (module-level) suggestion lookup of the kind's series vocabulary, e.g. `searchBookSeries`. */
  fetchSuggestions: (term: string, signal: AbortSignal) => Promise<NamedEntry[]>;
}

function normalizedName(entry: VocabularyDraft): string {
  return entry.name.trim().toLowerCase();
}

/**
 * Maps the chip input's new entries back to drafts, keeping each position: matched by id, or by case-insensitive
 * name so a pending chip that was upgraded to an existing entry (see `addEntry`) keeps its number.
 */
function withPositions(entries: VocabularyDraft[], previous: SeriesDraft[]): SeriesDraft[] {
  return entries.map((entry) => {
    const match =
      previous.find((old) => isExistingEntry(entry) && isExistingEntry(old.entry) && old.entry.id === entry.id) ??
      previous.find((old) => normalizedName(old.entry) === normalizedName(entry));
    return { entry, position: match?.position ?? "" };
  });
}

/**
 * The item's series: `VocabularyField` over the kind's series vocabulary for the chips, plus one row per selected series
 * with its optional position in that series.
 */
export function SeriesField({ value, onChange, disabled, showErrors, fetchSuggestions }: SeriesFieldProps) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <VocabularyField
        value={value.map((series) => series.entry)}
        onChange={(entries) => onChange(withPositions(entries, value))}
        disabled={disabled}
        fetchSuggestions={fetchSuggestions}
        label={t("media.series.label")}
        hint={t("media.series.hint")}
      />
      {value.map((series, index) => (
        <Box
          key={isExistingEntry(series.entry) ? series.entry.id : `pending:${normalizedName(series.entry)}`}
          sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}
        >
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0, pt: 1, overflowWrap: "anywhere" }}>
            {series.entry.name}
          </Typography>
          <SeriesPositionField
            value={series.position}
            onChange={(position) => onChange(value.map((old, i) => (i === index ? { ...old, position } : old)))}
            disabled={disabled}
            showErrors={showErrors}
            ariaLabel={`${t("media.series.position")} ${series.entry.name}`}
          />
        </Box>
      ))}
    </Stack>
  );
}
