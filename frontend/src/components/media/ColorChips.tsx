import { Stack } from "@mui/material";
import { ColorChip, type ColorChipItem } from "./ColorChip";

/**
 * Wrapping row of colored chips (read-only display, e.g. the platforms in the game details view). `centered` keeps
 * wrapped rows centered (cards); the default is left-aligned.
 */
export function ColorChips({ items, centered = false }: { items: ColorChipItem[]; centered?: boolean }) {
  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={1}
      sx={{ flexWrap: "wrap", ...(centered && { justifyContent: "center" }) }}
    >
      {items.map((item) => (
        <ColorChip key={item.id} item={item} />
      ))}
    </Stack>
  );
}
