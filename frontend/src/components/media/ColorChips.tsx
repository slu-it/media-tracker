import { Stack } from "@mui/material";
import { ColorChip, type ColorChipItem } from "./ColorChip";

/** Wrapping row of colored chips (read-only display, e.g. the platforms in the game details view). */
export function ColorChips({ items }: { items: ColorChipItem[] }) {
  return (
    <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
      {items.map((item) => (
        <ColorChip key={item.id} item={item} />
      ))}
    </Stack>
  );
}
