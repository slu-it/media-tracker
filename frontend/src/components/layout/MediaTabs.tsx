import { Box, Tab, Tabs } from "@mui/material";
import { useTranslation } from "react-i18next";
import { MEDIA_KINDS, type MediaKind } from "./mediaKinds";

interface MediaTabsProps {
  value: MediaKind;
  onChange: (kind: MediaKind) => void;
}

export function MediaTabs({ value, onChange }: MediaTabsProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Tabs
        value={value}
        onChange={(_event, next: MediaKind) => onChange(next)}
        aria-label={t("tabs.label")}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {MEDIA_KINDS.map((kind) => (
          <Tab key={kind} value={kind} label={t(`tabs.${kind}`)} />
        ))}
      </Tabs>
    </Box>
  );
}
