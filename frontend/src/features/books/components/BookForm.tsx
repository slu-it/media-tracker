import { Box, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CoverImage } from "../../../components/CoverImage";
import type { BookTypeResponse } from "../../../types/api";
import { withReleaseDate } from "../../../domain/media/draft";
import { validateCoverImageUrl } from "../../../domain/media/values";
import { COVER_UNDER_GAP, CoverAndInfoLayout } from "../../../components/media/CoverAndInfoLayout";
import { CoverImageUrlField } from "../../../components/media/fields/CoverImageUrlField";
import { DescriptionField } from "../../../components/media/fields/DescriptionField";
import { ReleaseDateField } from "../../../components/media/fields/ReleaseDateField";
import { ReleaseYearField } from "../../../components/media/fields/ReleaseYearField";
import { TitleField } from "../../../components/media/fields/TitleField";
import type { BookDraft } from "../domain/bookDraft";
import { BOOK_COVER_ASPECT_RATIO, BOOK_RELEASE_YEAR_SELECT_MIN } from "../domain/bookValues";
import { BookOwnershipToggleBar } from "./BookOwnershipToggleBar";
import { BookProgressToggleBar } from "./BookProgressToggleBar";
import { AuthorsField } from "./fields/AuthorsField";
import { BookTypesField } from "./fields/BookTypesField";

interface BookFormProps {
  value: BookDraft;
  onChange: (draft: BookDraft) => void;
  /** `null` while the book types are still loading. */
  types: BookTypeResponse[] | null;
  disabled?: boolean;
  showErrors?: boolean;
  /**
   * Reports whether the release date picker's current edit is valid; a parent gates saving on this in addition
   * to `isDraftValid(value)`, since an invalid in-progress edit does not reach `onChange` (see `ReleaseDateField`).
   */
  onValidityChange?: (valid: boolean) => void;
}

/**
 * The editable fields of a book plus a live cover preview. Validity is not owned here: parents derive it with
 * `isDraftValid(value)` (plus `onValidityChange`, see above) so the save button and the field errors share one
 * source of truth.
 */
export function BookForm({ value, onChange, types, disabled, showErrors, onValidityChange }: BookFormProps) {
  const { t } = useTranslation();
  const previewUrl = validateCoverImageUrl(value.coverImageUrl) === null ? value.coverImageUrl : null;
  return (
    <CoverAndInfoLayout
      scrollInfo
      cover={
        <CoverImage src={previewUrl} alt={t("media.coverPreview")} width={240} aspectRatio={BOOK_COVER_ASPECT_RATIO} />
      }
      underCover={
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: COVER_UNDER_GAP }}>
          <BookOwnershipToggleBar
            value={value.ownership}
            onChange={(ownership) => onChange({ ...value, ownership })}
            disabled={disabled}
            showLabel
          />
          <BookProgressToggleBar
            value={value.progress}
            onChange={(progress) => onChange({ ...value, progress })}
            disabled={disabled}
            showLabel
          />
        </Box>
      }
    >
      <Stack spacing={2}>
        <TitleField
          value={value.title}
          onChange={(title) => onChange({ ...value, title })}
          disabled={disabled}
          showErrors={showErrors}
          autoFocus
        />
        <DescriptionField
          value={value.description}
          onChange={(description) => onChange({ ...value, description })}
          disabled={disabled}
          showErrors={showErrors}
        />
        <BookTypesField
          value={value.typeIds}
          onChange={(typeIds) => onChange({ ...value, typeIds })}
          options={types}
          disabled={disabled}
          showErrors={showErrors}
        />
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
          <ReleaseYearField
            value={value.releaseYear}
            onChange={(releaseYear) => onChange({ ...value, releaseYear })}
            disabled={disabled || value.releaseDate !== null}
            showErrors={showErrors}
            minYear={BOOK_RELEASE_YEAR_SELECT_MIN}
          />
          <ReleaseDateField
            value={value.releaseDate}
            onChange={(releaseDate) => onChange(withReleaseDate(value, releaseDate))}
            disabled={disabled}
            showErrors={showErrors}
            onValidityChange={onValidityChange}
          />
        </Box>
        <AuthorsField
          value={value.authors}
          onChange={(authors) => onChange({ ...value, authors })}
          disabled={disabled}
        />
        <CoverImageUrlField
          value={value.coverImageUrl}
          onChange={(coverImageUrl) => onChange({ ...value, coverImageUrl })}
          disabled={disabled}
          showErrors={showErrors}
        />
      </Stack>
    </CoverAndInfoLayout>
  );
}
