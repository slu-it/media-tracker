import { Box, Chip, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { formatSeriesEntry, formatSeriesPosition, primarySeries } from "../../../domain/media/seriesLabel";
import type { GameResponse } from "../../../types/api";
import { CARD_CONTENT_GAP, MediaCardShell } from "../../../components/media/MediaCardShell";
import { GameStatusIcons } from "./GameStatusIcons";
import { ColorChips } from "../../../components/media/ColorChips";

/** Height of a small MUI Chip. */
const SMALL_CHIP_HEIGHT = 24;

/**
 * Cover with the title centered underneath; the whole card opens the detail dialog. In the series view the position
 * badge is passed as `description`, placed centered above the cover, so the card's `aria-label` does not hide it
 * (announced via `aria-describedby`). An unnumbered game gets an invisible placeholder of the badge's height so
 * covers stay aligned within a grid row. Elsewhere (overview, developers view) the description is one centered
 * column below the title, spaced like the card itself (`CARD_CONTENT_GAP`): the game's primary series
 * (`primarySeries`) as one chip ("Hades #1", or an invisible one-chip placeholder without series) followed by the
 * platform chips; the status icons follow as a child.
 */
export function GameCard({
  game,
  onOpen,
  seriesPosition,
}: {
  game: GameResponse;
  onOpen: (game: GameResponse) => void;
  /** Set by the series view: the game's number in the listed series, shown as a "#n" badge. */
  seriesPosition?: number | null;
}) {
  const { t, i18n } = useTranslation();
  const placeholder = <Box aria-hidden sx={{ height: SMALL_CHIP_HEIGHT, visibility: "hidden" }} />;
  const primary = primarySeries(game.series);
  const inSeriesView = seriesPosition !== undefined;
  return (
    <MediaCardShell
      title={game.title}
      coverImageUrl={game.coverImageUrl}
      onClick={() => onOpen(game)}
      desaturateCover={game.ownership === "watchlist"}
      descriptionPlacement={inSeriesView ? "top" : "bottom"}
      description={
        !inSeriesView ? (
          <Stack useFlexGap spacing={CARD_CONTENT_GAP} sx={{ alignItems: "center", maxWidth: "100%" }}>
            {primary ? (
              <Chip
                variant="outlined"
                size="small"
                sx={{ maxWidth: "100%" }}
                label={formatSeriesEntry(primary, t, i18n.language)}
              />
            ) : (
              placeholder
            )}
            <ColorChips items={game.platforms} centered />
          </Stack>
        ) : typeof seriesPosition === "number" ? (
          <Chip
            size="small"
            color="primary"
            label={t("media.series.positionBadge", {
              position: formatSeriesPosition(seriesPosition, i18n.language),
            })}
          />
        ) : (
          placeholder
        )
      }
    >
      {inSeriesView && <ColorChips items={game.platforms} centered />}
      <GameStatusIcons ownership={game.ownership} progress={game.progress} hidden={game.hidden} variant="card" />
    </MediaCardShell>
  );
}
