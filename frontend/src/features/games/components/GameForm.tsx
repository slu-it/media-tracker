import { Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CoverImage } from "../../../components/CoverImage";
import type { GamePlatformResponse } from "../../../types/api";
import type { GameDraft } from "../domain/gameDraft";
import { validateCoverImageUrl } from "../domain/gameValues";
import { CoverAndInfoLayout } from "./CoverAndInfoLayout";
import { CoverImageUrlField } from "./fields/CoverImageUrlField";
import { DescriptionField } from "./fields/DescriptionField";
import { GameTitleField } from "./fields/GameTitleField";
import { PlatformsField } from "./fields/PlatformsField";
import { RatingField } from "./fields/RatingField";
import { ReleaseYearField } from "./fields/ReleaseYearField";

interface GameFormProps {
  value: GameDraft;
  onChange: (draft: GameDraft) => void;
  platforms: GamePlatformResponse[] | null;
  disabled?: boolean;
  showErrors?: boolean;
}

/**
 * The editable fields of a game plus a live cover preview. Validity is not owned here: parents derive it with
 * `isDraftValid(value)` so the save button and the field errors share one source of truth.
 */
export function GameForm({ value, onChange, platforms, disabled, showErrors }: GameFormProps) {
  const { t } = useTranslation();
  const previewUrl = validateCoverImageUrl(value.coverImageUrl) === null ? value.coverImageUrl : null;
  return (
    <CoverAndInfoLayout
      cover={<CoverImage src={previewUrl} alt={t("games.coverPreview")} width={240} height={320} />}
      underCover={
        <RatingField
          value={value.rating}
          onChange={(rating) => onChange({ ...value, rating })}
          disabled={disabled}
          showErrors={showErrors}
        />
      }
    >
      <Stack spacing={2}>
        <GameTitleField
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
        <ReleaseYearField
          value={value.releaseYear}
          onChange={(releaseYear) => onChange({ ...value, releaseYear })}
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
