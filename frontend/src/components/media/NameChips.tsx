import { Chip, Stack } from "@mui/material";

/** A wrapping row of outlined neutral chips for vocabulary entries (developers, authors). */
export function NameChips({ items }: { items: { id: string; name: string }[] }) {
  return (
    <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
      {items.map((item) => (
        <Chip key={item.id} label={item.name} variant="outlined" size="small" />
      ))}
    </Stack>
  );
}
