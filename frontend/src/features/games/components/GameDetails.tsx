import { Box, Chip, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { Ownership, Progress } from "../domain/gameStatus";
import type { ExpansionResponse, GameResponse } from "../../../types/api";
import { CoverImage } from "../../../components/CoverImage";
import { formatReleaseDate } from "../domain/releaseDate";
import { COVER_UNDER_GAP, CoverAndInfoLayout } from "./CoverAndInfoLayout";
import { ExpansionList } from "./ExpansionList";
import { GameStatusIcons } from "./GameStatusIcons";
import { OwnershipSwitch } from "./OwnershipSwitch";
import { PlatformChips } from "./PlatformChips";
import { ProgressToggleBar } from "./ProgressToggleBar";
import { RatingField } from "./fields/RatingField";

interface GameDetailsProps {
  game: GameResponse;
  titleId: string;
  /** The game's expansions, below the platform pills; an empty list renders nothing there. */
  expansions: ExpansionResponse[];
  onSelectExpansion: (expansion: ExpansionResponse) => void;
  onMoveExpansion: (expansionId: string, targetIndex: number) => void;
  /** Opens the cover picker; the cover is clickable whenever this is set, whether or not it has a URL. */
  onPickCover?: () => void;
  /** When set, a quick ownership switch is shown under the rating; it displays `game.ownership`. */
  onOwnershipChange?: (next: Ownership) => void;
  /** When set, a quick progress toggle bar is shown under the rating; it displays `game.progress`. */
  onProgressChange?: (next: Progress) => void;
  /** When set, the rating stars are editable and report the new value (`null` clears it). */
  onRatingChange?: (next: number | null) => void;
  /** Blocks the ownership switch, the progress toggle and the rating while a quick save is in flight. */
  quickSaveBusy?: boolean;
}

/**
 * One game as shown in the detail dialog's view mode. Display only apart from the optional quick actions: clicking
 * the cover (`onPickCover`), the ownership switch (`onOwnershipChange`), the progress toggle bar
 * (`onProgressChange`) and the rating stars (`onRatingChange`), which each report a change for the caller to save. Without `onRatingChange` the stars are read-only.
 */
export function GameDetails({
  game,
  titleId,
  expansions,
  onSelectExpansion,
  onMoveExpansion,
  onPickCover,
  onOwnershipChange,
  onProgressChange,
  onRatingChange,
  quickSaveBusy,
}: GameDetailsProps) {
  const { t } = useTranslation();
  return (
    <CoverAndInfoLayout
      scrollInfo
      cover={
        <CoverImage
          src={game.coverImageUrl}
          alt={game.title}
          width={240}
          onClick={onPickCover}
          actionLabel={t("games.coverPicker.open")}
        />
      }
      underCover={
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: COVER_UNDER_GAP }}>
          {onRatingChange ? (
            <RatingField value={game.rating} onChange={onRatingChange} busy={quickSaveBusy} />
          ) : (
            <RatingField readOnly value={game.rating} />
          )}
          {onOwnershipChange && (
            <OwnershipSwitch value={game.ownership} onChange={onOwnershipChange} disabled={quickSaveBusy} showLabel />
          )}
          {onProgressChange && (
            <ProgressToggleBar value={game.progress} onChange={onProgressChange} disabled={quickSaveBusy} showLabel />
          )}
        </Box>
      }
      infoHeader={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography id={titleId} variant="h5" component="h2">
            {game.title}
          </Typography>
          <GameStatusIcons ownership={game.ownership} progress={game.progress} hidden={game.hidden} />
        </Box>
      }
    >
      <Stack spacing={2}>
        {game.description && (
          <Typography variant="body1" color="text.primary" sx={{ whiteSpace: "pre-wrap" }}>
            {game.description}
          </Typography>
        )}
        {game.releaseDate === null ? (
          <Field label={t("games.fields.releaseYear")}>{game.releaseYear}</Field>
        ) : (
          <Field label={t("games.fields.releaseDate")}>{formatReleaseDate(game.releaseDate)}</Field>
        )}
        <Field label={t("games.fields.platforms")}>
          <PlatformChips platforms={game.platforms} />
        </Field>
        {game.developers.length > 0 && (
          <Field label={t("games.fields.developers")}>
            <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
              {game.developers.map((developer) => (
                <Chip key={developer.id} label={developer.name} variant="outlined" size="small" />
              ))}
            </Stack>
          </Field>
        )}
        <ExpansionList expansions={expansions} onSelect={onSelectExpansion} onMove={onMoveExpansion} />
      </Stack>
    </CoverAndInfoLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Typography variant="overline" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography component="div">{children}</Typography>
    </div>
  );
}
