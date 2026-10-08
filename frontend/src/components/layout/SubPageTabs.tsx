import { Box, Tab, Tabs } from "@mui/material";
import type { ReactElement } from "react";

interface SubPageTabsProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  getLabel: (option: T) => string;
  /** Accessible name of the tablist (a separate tablist from the media tabs, named per kind). */
  ariaLabel: string;
  /** Optional decorative prefix icon per option; the tab name stays the label. */
  getIcon?: (option: T) => ReactElement;
}

/**
 * Second, smaller tab row for the sub-pages of the active media kind (e.g. the games overview/watchlist/ranking
 * pages, or the books overview), rendered below `MediaTabs`. Visually subordinate to the media tabs: a lower min-height and denser tab
 * padding, and its own `ariaLabel` since it is a separate tablist.
 */
export function SubPageTabs<T extends string>({
  value,
  options,
  onChange,
  getLabel,
  ariaLabel,
  getIcon,
}: SubPageTabsProps<T>) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Tabs
        value={value}
        onChange={(_event, next: T) => onChange(next)}
        aria-label={ariaLabel}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ minHeight: 36 }}
      >
        {options.map((option) => (
          <Tab
            key={option}
            value={option}
            label={getLabel(option)}
            icon={getIcon?.(option)}
            iconPosition="start"
            sx={{ minHeight: 36, py: 0.5, fontSize: "0.8125rem", "& .MuiTab-icon": { mr: 0.75 } }}
          />
        ))}
      </Tabs>
    </Box>
  );
}
