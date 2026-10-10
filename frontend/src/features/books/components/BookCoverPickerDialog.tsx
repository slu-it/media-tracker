import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CoverPickerDialog as MediaCoverPickerDialog,
  type CoverPickerDialogProps as MediaCoverPickerDialogProps,
} from "../../../components/media/cover/CoverPickerDialog";
import type { CoverPageRequest } from "../../../hooks/useCoverOptions";
import type { BookCoverSource } from "../../../types/api";
import { getBookCoverOptions } from "../api/booksApi";
import { BOOK_COVER_SOURCES } from "../domain/bookCoverSource";
import { BOOK_COVER_ASPECT_RATIO } from "../domain/bookValues";

type BookCoverPickerDialogProps = Pick<
  MediaCoverPickerDialogProps<string, BookCoverSource>,
  "open" | "onClose" | "initialQuery" | "releaseYear" | "currentCoverUrl" | "onPick"
> & {
  /** The source the toggle starts on at every open (see `defaultCoverSource`). */
  defaultSource: BookCoverSource;
};

function fetchBookCoverPage({ query, releaseYear, match, variant, page }: CoverPageRequest<string, BookCoverSource>) {
  return getBookCoverOptions({ query, releaseYear, match, source: variant, page });
}

/**
 * Search Open Library (books) or Audible (audiobooks) for covers; persistence is entirely up to the host via
 * `onPick`.
 */
export function BookCoverPickerDialog({ open, ...props }: BookCoverPickerDialogProps) {
  if (!open) return null;
  return <BookCoverPicker {...props} />;
}

// Split from the open gate above so the book/audiobook choice starts over (from `defaultSource`) on every open.
function BookCoverPicker({ defaultSource, ...props }: Omit<BookCoverPickerDialogProps, "open">) {
  const { t } = useTranslation();
  const [source, setSource] = useState<BookCoverSource>(defaultSource);
  return (
    <MediaCoverPickerDialog
      open
      {...props}
      variant={source}
      variants={{
        options: BOOK_COVER_SOURCES.map((value) => ({
          value,
          label: t(value === "book" ? "books.coverPicker.sourceBook" : "books.coverPicker.sourceAudiobook"),
        })),
        onChange: setSource,
        ariaLabel: t("books.coverPicker.source"),
      }}
      aspectRatio={BOOK_COVER_ASPECT_RATIO}
      fetchPage={fetchBookCoverPage}
      // Unreachable for books (no 503, ADR 0039) but required by the shared dialog.
      unavailableCode="cover_source_unavailable"
      texts={{
        match: t("books.coverPicker.match"),
        noMatches: (term) =>
          t(source === "book" ? "books.coverPicker.noMatches" : "books.coverPicker.noMatchesAudiobook", { term }),
        noCovers: t("books.coverPicker.noCovers"),
        unavailable: t("books.coverPicker.unavailable"),
        attribution: t(
          source === "book" ? "books.coverPicker.attributionBook" : "books.coverPicker.attributionAudiobook",
        ),
      }}
    />
  );
}
