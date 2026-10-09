import { Chip, Stack } from "@mui/material";

/**
 * Outlined neutral chips for vocabulary entries (developers, authors, series). `direction="row"` (default) is a
 * wrapping row; `"column"` stacks them centered, one per line, with a long label ellipsized at the container width.
 */
export function NameChips({
  items,
  direction = "row",
}: {
  items: { id: string; name: string }[];
  direction?: "row" | "column";
}) {
  const column = direction === "column";
  return (
    <Stack
      direction={direction}
      useFlexGap
      spacing={column ? 0.5 : 1}
      sx={column ? { alignItems: "center", maxWidth: "100%" } : { flexWrap: "wrap" }}
    >
      {items.map((item) => (
        <Chip key={item.id} label={item.name} variant="outlined" size="small" sx={{ maxWidth: "100%" }} />
      ))}
    </Stack>
  );
}
