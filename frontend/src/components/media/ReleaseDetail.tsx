import { useTranslation } from "react-i18next";
import { formatReleaseDate } from "../../domain/media/releaseDate";
import { DetailField } from "./DetailField";

interface ReleaseDetailProps {
  releaseDate: string | null;
  releaseYear: number | null;
}

/** "Release date" with the formatted date when one is set, otherwise "Release year" with the year. */
export function ReleaseDetail({ releaseDate, releaseYear }: ReleaseDetailProps) {
  const { t } = useTranslation();
  return releaseDate === null ? (
    <DetailField label={t("media.fields.releaseYear")}>{releaseYear}</DetailField>
  ) : (
    <DetailField label={t("media.fields.releaseDate")}>{formatReleaseDate(releaseDate)}</DetailField>
  );
}
