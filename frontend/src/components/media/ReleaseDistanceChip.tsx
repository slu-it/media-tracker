import { Chip } from "@mui/material";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { isReleased, releaseDistance } from "../../domain/media/releaseDate";

/**
 * Filled chip for a (day-precise) release date: the ISO-8601 duration from today for a future date (see
 * `releaseDistance`), a translated "Available" once the date is today or in the past.
 */
export function ReleaseDistanceChip({ releaseDate }: { releaseDate: string }) {
  const { t } = useTranslation();
  const today = dayjs();
  return (
    <Chip
      size="small"
      label={isReleased(releaseDate, today) ? t("media.available") : releaseDistance(releaseDate, today)}
    />
  );
}
