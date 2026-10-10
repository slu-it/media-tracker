import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BookResponse } from "../../../types/api";
import { CoverImage } from "../../../components/CoverImage";
import { COVER_UNDER_GAP, CoverAndInfoLayout } from "../../../components/media/CoverAndInfoLayout";
import { ColorChips } from "../../../components/media/ColorChips";
import { DetailField } from "../../../components/media/DetailField";
import { NameChips } from "../../../components/media/NameChips";
import { ReleaseDetail } from "../../../components/media/ReleaseDetail";
import type { BookOwnership, BookProgress } from "../domain/bookStatus";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";
import { formatSeriesEntry } from "../domain/seriesLabel";
import { BookOwnershipToggleBar } from "./BookOwnershipToggleBar";
import { BookProgressToggleBar } from "./BookProgressToggleBar";
import { BookStatusIcons } from "./BookStatusIcons";

interface BookDetailsProps {
  book: BookResponse;
  titleId: string;
  /** Opens the cover picker; the cover is clickable whenever this is set, whether or not it has a URL. */
  onPickCover?: () => void;
  /** When set, a quick ownership switch is shown under the cover; it displays `book.ownership`. */
  onOwnershipChange?: (next: BookOwnership) => void;
  /** When set, a quick progress toggle bar is shown under the cover; it displays `book.progress`. */
  onProgressChange?: (next: BookProgress) => void;
  /** Blocks the ownership and progress bars while a quick save is in flight. */
  quickSaveBusy?: boolean;
}

/**
 * One book as shown in the detail dialog's view mode. Display only apart from the optional quick actions (the
 * ownership and progress bars) and clicking the cover (`onPickCover`), which report a change for the caller to save. The info body shows the series chips
 * (unlabelled), the description, then a two-column grid: release and types, then authors and narrators (the row is
 * omitted when both are empty; a missing field leaves its cell empty).
 */
export function BookDetails({
  book,
  titleId,
  onPickCover,
  onOwnershipChange,
  onProgressChange,
  quickSaveBusy,
}: BookDetailsProps) {
  const { t, i18n } = useTranslation();
  const hasPeople = book.authors.length > 0 || book.narrators.length > 0;
  return (
    <CoverAndInfoLayout
      scrollInfo
      cover={
        <CoverImage
          src={book.coverImageUrl}
          alt={book.title}
          width={240}
          aspectRatio={BOOK_COVER_ASPECT_RATIO}
          onClick={onPickCover}
          actionLabel={t("books.coverPicker.open")}
        />
      }
      underCover={
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: COVER_UNDER_GAP }}>
          {onOwnershipChange && (
            <BookOwnershipToggleBar
              value={book.ownership}
              onChange={onOwnershipChange}
              disabled={quickSaveBusy}
              showLabel
            />
          )}
          {onProgressChange && (
            <BookProgressToggleBar
              value={book.progress}
              onChange={onProgressChange}
              disabled={quickSaveBusy}
              showLabel
            />
          )}
        </Box>
      }
      infoHeader={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography id={titleId} variant="h5" component="h2">
            {book.title}
          </Typography>
          <BookStatusIcons ownership={book.ownership} progress={book.progress} />
        </Box>
      }
    >
      <Stack spacing={2}>
        {book.series.length > 0 && (
          <Box role="group" aria-label={t("books.fields.series")}>
            <NameChips
              items={book.series.map((entry) => ({
                id: entry.id,
                name: formatSeriesEntry(entry, t, i18n.language),
              }))}
            />
          </Box>
        )}
        {book.description && (
          <Typography variant="body1" color="text.primary" sx={{ whiteSpace: "pre-wrap" }}>
            {book.description}
          </Typography>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            columnGap: 3,
            rowGap: 2,
          }}
        >
          <ReleaseDetail releaseDate={book.releaseDate} releaseYear={book.releaseYear} />
          {book.types.length > 0 ? (
            <DetailField label={t("books.fields.types")}>
              <ColorChips items={book.types} />
            </DetailField>
          ) : (
            <div />
          )}
          {hasPeople && (
            <>
              {book.authors.length > 0 ? (
                <DetailField label={t("books.fields.authors")}>
                  <NameChips items={book.authors} />
                </DetailField>
              ) : (
                <div />
              )}
              {book.narrators.length > 0 ? (
                <DetailField label={t("books.fields.narrators")}>
                  <NameChips items={book.narrators} />
                </DetailField>
              ) : (
                <div />
              )}
            </>
          )}
        </Box>
      </Stack>
    </CoverAndInfoLayout>
  );
}
