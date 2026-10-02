import { Box, Tab, Tabs } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useActiveRoute } from "../../hooks/useActiveRoute";
import { storedPathFor } from "../../routes";
import { MEDIA_KINDS, type MediaKind } from "./mediaKinds";

/** Media-kind tabs; the selected tab follows the route and a click navigates to the kind's (last-used) path. */
export function MediaTabs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const route = useActiveRoute();
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Tabs
        value={route?.kind ?? false}
        onChange={(_event, next: MediaKind) => void navigate(storedPathFor(next))}
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
