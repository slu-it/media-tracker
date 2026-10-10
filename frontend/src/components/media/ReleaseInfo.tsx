import { Stack, Typography } from "@mui/material";
import { formatReleaseDate } from "../../domain/media/releaseDate";
import { ReleaseDistanceChip } from "./ReleaseDistanceChip";

/**
 * The exact release date when known, followed by a chip with the ISO-8601 distance for a future date and "Available"
 * for today or the past, otherwise just the release year.
 */
export function ReleaseInfo({ releaseDate, releaseYear }: { releaseDate: string | null; releaseYear: number }) {
  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={1}
      sx={{ flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}
    >
      <Typography variant="body2" color="text.secondary">
        {releaseDate ? formatReleaseDate(releaseDate) : releaseYear}
      </Typography>
      {releaseDate && <ReleaseDistanceChip releaseDate={releaseDate} />}
    </Stack>
  );
}
