import { Stack } from "@mui/material";
import type { GamePlatformResponse } from "../../../types/api";
import { PlatformChip } from "./PlatformChip";

/** Wrapping row of platform chips (read-only display, e.g. in the game details view). */
export function PlatformChips({ platforms }: { platforms: GamePlatformResponse[] }) {
  return (
    <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
      {platforms.map((platform) => (
        <PlatformChip key={platform.id} platform={platform} />
      ))}
    </Stack>
  );
}
