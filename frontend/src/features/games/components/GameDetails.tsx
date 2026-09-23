import { Box, Rating, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ExpansionResponse, GameResponse } from "../../../types/api";
import { CoverImage } from "../../../components/CoverImage";
import { CoverAndInfoLayout } from "./CoverAndInfoLayout";
import { ExpansionList } from "./ExpansionList";
import { GameStatusIcons } from "./GameStatusIcons";
import { PlatformChips } from "./PlatformChips";

interface GameDetailsProps {
  game: GameResponse;
  titleId: string;
  /** The game's expansions, below the platform pills; an empty list renders nothing there. */
  expansions: ExpansionResponse[];
  onSelectExpansion: (expansion: ExpansionResponse) => void;
  onMoveExpansion: (expansionId: string, targetIndex: number) => void;
  /** Opens the cover picker; the cover is clickable whenever this is set, whether or not it has a URL. */
  onPickCover?: () => void;
}

/** Read-only view of one game (the detail dialog's view mode). */
export function GameDetails({
  game,
  titleId,
  expansions,
  onSelectExpansion,
  onMoveExpansion,
  onPickCover,
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
        <Box
          role="group"
          aria-label={t("games.fields.rating")}
          sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
        >
          <Rating readOnly precision={0.25} value={game.rating} />
          <Typography color="text.secondary" variant="body2">
            {game.rating === null ? t("games.notRated") : game.rating}
          </Typography>
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
        <Field label={t("games.fields.releaseYear")}>{game.releaseYear}</Field>
        <Field label={t("games.fields.platforms")}>
          <PlatformChips platforms={game.platforms} />
        </Field>
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
