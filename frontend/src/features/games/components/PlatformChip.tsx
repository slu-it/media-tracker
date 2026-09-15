import { Chip, useTheme, type ChipProps } from "@mui/material";
import type { GamePlatformResponse } from "../../../types/api";

interface PlatformChipProps extends Omit<ChipProps, "label" | "sx"> {
  platform: GamePlatformResponse;
}

/**
 * A platform as a colored chip: background from `associatedColor`, text color picked for contrast. Extra
 * `ChipProps` (e.g. `onDelete`, `tabIndex`) pass through so it also works as an Autocomplete tag.
 */
export function PlatformChip({ platform, ...chipProps }: PlatformChipProps) {
  const theme = useTheme();
  const backgroundColor = `#${platform.associatedColor}`;
  return (
    <Chip
      size="small"
      label={platform.label}
      sx={{ bgcolor: backgroundColor, color: theme.palette.getContrastText(backgroundColor) }}
      {...chipProps}
    />
  );
}
