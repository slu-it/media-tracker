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
import { BookOwnershipToggleBar } from "./BookOwnershipToggleBar";
import { BookProgressToggleBar } from "./BookProgressToggleBar";
import { BookStatusIcons } from "./BookStatusIcons";

interface BookDetailsProps {
  book: BookResponse;
  titleId: string;
  /** When set, a quick ownership switch is shown under the cover; it displays `book.ownership`. */
  onOwnershipChange?: (next: BookOwnership) => void;
  /** When set, a quick progress toggle bar is shown under the cover; it displays `book.progress`. */
  onProgressChange?: (next: BookProgress) => void;
  /** Blocks the ownership and progress bars while a quick save is in flight. */
  quickSaveBusy?: boolean;
}

/**
 * One book as shown in the detail dialog's view mode. Display only apart from the optional quick actions (the
 * ownership and progress bars), which report a change for the caller to save.
 */
export function BookDetails({ book, titleId, onOwnershipChange, onProgressChange, quickSaveBusy }: BookDetailsProps) {
  const { t } = useTranslation();
  return (
    <CoverAndInfoLayout
      scrollInfo
      cover={<CoverImage src={book.coverImageUrl} alt={book.title} width={240} aspectRatio={BOOK_COVER_ASPECT_RATIO} />}
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
        {book.description && (
          <Typography variant="body1" color="text.primary" sx={{ whiteSpace: "pre-wrap" }}>
            {book.description}
          </Typography>
        )}
        <ReleaseDetail releaseDate={book.releaseDate} releaseYear={book.releaseYear} />
        {book.types.length > 0 && (
          <DetailField label={t("books.fields.types")}>
            <ColorChips items={book.types} />
          </DetailField>
        )}
        {book.authors.length > 0 && (
          <DetailField label={t("books.fields.authors")}>
            <NameChips items={book.authors} />
          </DetailField>
        )}
      </Stack>
    </CoverAndInfoLayout>
  );
}
