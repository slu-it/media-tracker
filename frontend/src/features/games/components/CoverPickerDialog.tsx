import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CoverPickerDialog as MediaCoverPickerDialog,
  type CoverPickerDialogProps as MediaCoverPickerDialogProps,
} from "../../../components/media/cover/CoverPickerDialog";
import type { CoverPageRequest } from "../../../hooks/useCoverOptions";
import { getCoverOptions } from "../api/gamesApi";
import { COVER_TYPES, DEFAULT_COVER_TYPE, type CoverType } from "../domain/coverTypes";

type CoverPickerDialogProps = Pick<
  MediaCoverPickerDialogProps<number, CoverType>,
  "open" | "onClose" | "initialQuery" | "releaseYear" | "currentCoverUrl" | "onPick"
>;

/** The backend's own default `type` is never put on the wire, so a default request needs no `type=` in its URL. */
function fetchGameCoverPage({ query, releaseYear, match, variant, page }: CoverPageRequest<number, CoverType>) {
  return getCoverOptions({
    query,
    releaseYear,
    match,
    type: variant === DEFAULT_COVER_TYPE ? undefined : variant,
    page,
  });
}

/** Search SteamGridDB for game covers (static or animated); persistence is entirely up to the host via `onPick`. */
export function CoverPickerDialog({ open, ...props }: CoverPickerDialogProps) {
  if (!open) return null;
  return <GameCoverPicker {...props} />;
}

// Split from the open gate above so the static/animated choice starts over on every open.
function GameCoverPicker(props: Omit<CoverPickerDialogProps, "open">) {
  const { t } = useTranslation();
  const [coverType, setCoverType] = useState<CoverType>(DEFAULT_COVER_TYPE);
  return (
    <MediaCoverPickerDialog
      open
      {...props}
      variant={coverType}
      variants={{
        options: COVER_TYPES.map((value) => ({
          value,
          label: t(value === "static" ? "games.coverPicker.typeStatic" : "games.coverPicker.typeAnimated"),
        })),
        onChange: setCoverType,
        ariaLabel: t("games.coverPicker.type"),
      }}
      fetchPage={fetchGameCoverPage}
      unavailableCode="cover_source_unavailable"
      texts={{
        match: t("games.coverPicker.match"),
        noMatches: (term) => t("games.coverPicker.noMatches", { term }),
        noCovers: t("games.coverPicker.noCovers"),
        unavailable: t("games.coverPicker.unavailable"),
        attribution: t("games.coverPicker.attribution"),
      }}
    />
  );
}
