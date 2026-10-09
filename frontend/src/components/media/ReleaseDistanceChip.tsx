import { Chip } from "@mui/material";
import { releaseDistance } from "../../domain/media/releaseDate";

/** Filled chip with the ISO-8601 duration from today to the (day-precise) release date, see `releaseDistance`. */
export function ReleaseDistanceChip({ releaseDate }: { releaseDate: string }) {
  return <Chip size="small" label={releaseDistance(releaseDate)} />;
}
