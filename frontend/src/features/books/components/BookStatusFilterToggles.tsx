import { useTranslation } from "react-i18next";
import { StatusFilterBar } from "../../../components/media/status/StatusFilterBar";
import type { BookMetaResponse } from "../../../types/api";
import type { BookFilters } from "../domain/bookFilters";
import { BOOK_OWNERSHIP_VALUES, BOOK_PROGRESS_VALUES } from "../domain/bookStatus";
import { BOOK_OWNERSHIP_ICONS } from "./bookOwnershipIcons";
import { BOOK_PROGRESS_ICONS } from "./bookProgressIcons";

interface BookStatusFilterTogglesProps {
  filters: BookFilters;
  onChange: (filters: BookFilters) => void;
  /** `null` while the filter values are still loading; nothing is dimmed then. */
  meta: BookMetaResponse | null;
}

/**
 * The progress and ownership filters as two multi-select icon toggle groups for the results row. Renders a
 * fragment, so both bars are direct items of the flex row they are placed in. Nothing pressed means no filter on
 * that field. A value that no stored book has (per `meta`) is dimmed (with a "no books" hint) but stays clickable.
 */
export function BookStatusFilterToggles({ filters, onChange, meta }: BookStatusFilterTogglesProps) {
  const { t } = useTranslation();
  return (
    <>
      <StatusFilterBar
        values={BOOK_PROGRESS_VALUES}
        icons={BOOK_PROGRESS_ICONS}
        getLabel={(value) => t(`books.progress.${value}`)}
        groupLabel={t("media.filters.progress")}
        value={filters.progress}
        onChange={(progress) => onChange({ ...filters, progress })}
        available={meta?.progress ?? null}
        dimmedHint={t("books.filters.noBooks")}
      />
      <StatusFilterBar
        values={BOOK_OWNERSHIP_VALUES}
        icons={BOOK_OWNERSHIP_ICONS}
        getLabel={(value) => t(`books.ownership.${value}`)}
        groupLabel={t("media.filters.ownership")}
        value={filters.ownership}
        onChange={(ownership) => onChange({ ...filters, ownership })}
        available={meta?.ownership ?? null}
        dimmedHint={t("books.filters.noBooks")}
      />
    </>
  );
}
