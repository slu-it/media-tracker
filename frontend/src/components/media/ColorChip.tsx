import { Chip, useTheme, type ChipProps } from "@mui/material";

/** What a colored chip shows; structurally the same as `GamePlatformResponse`. `associatedColor` is hex without `#`. */
export interface ColorChipItem {
  id: string;
  label: string;
  associatedColor: string;
}

interface ColorChipProps extends Omit<ChipProps, "label" | "sx"> {
  item: ColorChipItem;
}

/**
 * An item (e.g. a platform) as a colored chip: background from `associatedColor`, text color picked for contrast. Extra
 * `ChipProps` (e.g. `onDelete`, `tabIndex`) pass through so it also works as an Autocomplete tag.
 */
export function ColorChip({ item, ...chipProps }: ColorChipProps) {
  const theme = useTheme();
  const backgroundColor = `#${item.associatedColor}`;
  return (
    <Chip
      size="small"
      label={item.label}
      sx={{ bgcolor: backgroundColor, color: theme.palette.getContrastText(backgroundColor) }}
      {...chipProps}
    />
  );
}
