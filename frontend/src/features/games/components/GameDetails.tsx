import { Box, Rating, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { GameResponse } from "../../../types/api";
import { CoverImage } from "../../../components/CoverImage";
import { CoverAndInfoLayout } from "./CoverAndInfoLayout";
import { PlatformChips } from "./PlatformChips";

/** Read-only view of one game (the detail dialog's view mode). */
export function GameDetails({ game, titleId }: { game: GameResponse; titleId: string }) {
  const { t } = useTranslation();
  return (
    <CoverAndInfoLayout
      cover={<CoverImage src={game.coverImageUrl} alt={game.title} width={240} height={320} />}
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
    >
      <Stack spacing={2}>
        <div>
          <Typography id={titleId} variant="h5" component="h2">
            {game.title}
          </Typography>
          {game.description && (
            <Typography variant="body1" color="text.primary" sx={{ whiteSpace: "pre-wrap", mt: 1 }}>
              {game.description}
            </Typography>
          )}
        </div>
        <Field label={t("games.fields.releaseYear")}>{game.releaseYear}</Field>
        <Field label={t("games.fields.platforms")}>
          <PlatformChips platforms={game.platforms} />
        </Field>
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
