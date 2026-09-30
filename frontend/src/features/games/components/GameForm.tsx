import { useState } from "react";
import { Box, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CoverImage } from "../../../components/CoverImage";
import type { GamePlatformResponse } from "../../../types/api";
import { type GameDraft, withReleaseDate } from "../domain/gameDraft";
import { validateCoverImageUrl } from "../domain/gameValues";
import { COVER_UNDER_GAP, CoverAndInfoLayout } from "./CoverAndInfoLayout";
import { CoverPickerDialog } from "./CoverPickerDialog";
import { OwnershipSwitch } from "./OwnershipSwitch";
import { ProgressToggleBar } from "./ProgressToggleBar";
import { CoverImageUrlField } from "./fields/CoverImageUrlField";
import { DescriptionField } from "./fields/DescriptionField";
import { DevelopersField } from "./fields/DevelopersField";
import { GameTitleField } from "./fields/GameTitleField";
import { HiddenField } from "./fields/HiddenField";
import { PlatformsField } from "./fields/PlatformsField";
import { RatingField } from "./fields/RatingField";
import { ReleaseDateField } from "./fields/ReleaseDateField";
import { ReleaseYearField } from "./fields/ReleaseYearField";

interface GameFormProps {
  value: GameDraft;
  onChange: (draft: GameDraft) => void;
  platforms: GamePlatformResponse[] | null;
  disabled?: boolean;
  showErrors?: boolean;
  /** Debounce before a title-suggestion request fires; tests pass a short value to stay on real timers. */
  titleSuggestionDebounceMs?: number;
  /**
   * Reports whether the release date picker's current edit is valid; a parent gates saving on this in addition
   * to `isDraftValid(value)`, since an invalid in-progress edit does not reach `onChange` (see `ReleaseDateField`).
   */
  onValidityChange?: (valid: boolean) => void;
}

/**
 * The editable fields of a game plus a live cover preview. Validity is not owned here: parents derive it with
 * `isDraftValid(value)` (plus `onValidityChange`, see above) so the save button and the field errors share one
 * source of truth.
 */
export function GameForm({
  value,
  onChange,
  platforms,
  disabled,
  showErrors,
  titleSuggestionDebounceMs,
  onValidityChange,
}: GameFormProps) {
  const { t } = useTranslation();
  const previewUrl = validateCoverImageUrl(value.coverImageUrl) === null ? value.coverImageUrl : null;
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <>
      <CoverAndInfoLayout
        scrollInfo
        cover={
          <CoverImage
            src={previewUrl}
            alt={t("games.coverPreview")}
            width={240}
            onClick={disabled ? undefined : () => setPickerOpen(true)}
            actionLabel={t("games.coverPicker.open")}
          />
        }
        underCover={
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: COVER_UNDER_GAP }}>
            <RatingField
              value={value.rating}
              onChange={(rating) => onChange({ ...value, rating })}
              disabled={disabled}
              showErrors={showErrors}
            />
            <OwnershipSwitch
              value={value.ownership}
              onChange={(ownership) => onChange({ ...value, ownership })}
              disabled={disabled}
              showLabel
            />
            <ProgressToggleBar
              value={value.progress}
              onChange={(progress) => onChange({ ...value, progress })}
              disabled={disabled}
              showLabel
            />
          </Box>
        }
      >
        <Stack spacing={2}>
          <GameTitleField
            value={value.title}
            onChange={(title) => onChange({ ...value, title })}
            onSuggestionPick={(suggestion) =>
              onChange({
                ...value,
                title: suggestion.name,
                ...(suggestion.releaseYear !== null && value.releaseDate === null
                  ? { releaseYear: suggestion.releaseYear }
                  : {}),
              })
            }
            disabled={disabled}
            showErrors={showErrors}
            autoFocus
            suggestionDebounceMs={titleSuggestionDebounceMs}
          />
          <DescriptionField
            value={value.description}
            onChange={(description) => onChange({ ...value, description })}
            disabled={disabled}
            showErrors={showErrors}
          />
          <PlatformsField
            value={value.platformIds}
            onChange={(platformIds) => onChange({ ...value, platformIds })}
            options={platforms}
            disabled={disabled}
            showErrors={showErrors}
          />
          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
            <ReleaseYearField
              value={value.releaseYear}
              onChange={(releaseYear) => onChange({ ...value, releaseYear })}
              disabled={disabled || value.releaseDate !== null}
              showErrors={showErrors}
            />
            <ReleaseDateField
              value={value.releaseDate}
              onChange={(releaseDate) => onChange(withReleaseDate(value, releaseDate))}
              disabled={disabled}
              showErrors={showErrors}
              onValidityChange={onValidityChange}
            />
          </Box>
          <DevelopersField
            value={value.developers}
            onChange={(developers) => onChange({ ...value, developers })}
            disabled={disabled}
          />
          <HiddenField value={value.hidden} onChange={(hidden) => onChange({ ...value, hidden })} disabled={disabled} />
          <CoverImageUrlField
            value={value.coverImageUrl}
            onChange={(coverImageUrl) => onChange({ ...value, coverImageUrl })}
            disabled={disabled}
            showErrors={showErrors}
          />
        </Stack>
      </CoverAndInfoLayout>
      <CoverPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialQuery={value.title}
        releaseYear={value.releaseYear}
        currentCoverUrl={previewUrl}
        onPick={(url) => {
          onChange({ ...value, coverImageUrl: url });
          setPickerOpen(false);
        }}
      />
    </>
  );
}
