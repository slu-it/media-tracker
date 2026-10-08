import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { VocabularyField } from "../../../../components/media/fields/VocabularyField";
import { isExistingEntry, type VocabularyDraft } from "../../../../domain/media/vocabularyDraft";
import { searchBookSeries } from "../../api/booksApi";
import type { SeriesDraft } from "../../domain/bookDraft";
import { SeriesPositionField } from "./SeriesPositionField";

interface SeriesFieldProps {
  value: SeriesDraft[];
  onChange: (value: SeriesDraft[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
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
 * The book's series: `VocabularyField` over `/api/book-series` for the chips, plus one row per selected series
 * with its optional position in that series.
 */
export function SeriesField({ value, onChange, disabled, showErrors }: SeriesFieldProps) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <VocabularyField
        value={value.map((series) => series.entry)}
        onChange={(entries) => onChange(withPositions(entries, value))}
        disabled={disabled}
        fetchSuggestions={searchBookSeries}
        label={t("books.fields.series")}
        hint={t("books.fields.seriesHint")}
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
            ariaLabel={`${t("books.fields.seriesPosition")} ${series.entry.name}`}
          />
        </Box>
      ))}
    </Stack>
  );
}
