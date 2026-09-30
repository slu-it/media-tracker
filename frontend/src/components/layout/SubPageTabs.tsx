import { Box, Tab, Tabs } from "@mui/material";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

interface SubPageTabsProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  getLabel: (option: T) => string;
  /** Optional decorative prefix icon per option; the tab name stays the label. */
  getIcon?: (option: T) => ReactElement;
}

/**
 * Second, smaller tab row for the sub-pages of the active media kind (e.g. the games overview/watchlist/ranking
 * pages), rendered below `MediaTabs`. Visually subordinate to the media tabs: a lower min-height and denser tab
 * padding, and its own `aria-label` since it is a separate tablist.
 */
export function SubPageTabs<T extends string>({ value, options, onChange, getLabel, getIcon }: SubPageTabsProps<T>) {
  const { t } = useTranslation();
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Tabs
        value={value}
        onChange={(_event, next: T) => onChange(next)}
        aria-label={t("subPages.label")}
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
