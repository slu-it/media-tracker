import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/** Placeholder body for media kinds that are not implemented yet; centered on both axes. */
export function ComingSoon() {
  const { t } = useTranslation();
  return (
    <Box sx={{ flex: 1, minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <Typography variant="h5" color="text.secondary">
        {t("common.comingSoon")}
      </Typography>
    </Box>
  );
}
