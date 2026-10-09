import { Chip, Stack } from "@mui/material";

/** Outlined neutral chips for vocabulary entries (developers, authors, series) in a wrapping row. */
export function NameChips({ items }: { items: { id: string; name: string }[] }) {
  return (
    <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
      {items.map((item) => (
        <Chip key={item.id} label={item.name} variant="outlined" size="small" sx={{ maxWidth: "100%" }} />
      ))}
    </Stack>
  );
}
