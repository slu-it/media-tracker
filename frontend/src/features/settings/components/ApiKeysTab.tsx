import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useApiKeys } from "../hooks/useApiKeys";
import { ApiKeyField } from "./ApiKeyField";

/** API keys for MCP clients: a hint plus the primary and secondary key rows. */
export function ApiKeysTab() {
  const { t } = useTranslation();
  const { keys, loading, error, busySlot, regenerate, reload } = useApiKeys(
    t("settings.apiKeys.loadFailed"),
    t("settings.apiKeys.regenerateFailed"),
  );

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t("settings.apiKeys.hint")}
      </Typography>
      {error && (
        <Alert severity="error" action={<Button onClick={reload}>{t("common.retry")}</Button>}>
          {error}
        </Alert>
      )}
      {loading && <Typography variant="body2">{t("common.loading")}</Typography>}
      {keys !== null && (
        <>
          <ApiKeyField
            label={t("settings.apiKeys.primary")}
            value={keys.primary}
            busy={busySlot === "primary"}
            onRegenerate={() => void regenerate("primary")}
          />
          <ApiKeyField
            label={t("settings.apiKeys.secondary")}
            value={keys.secondary}
            busy={busySlot === "secondary"}
            onRegenerate={() => void regenerate("secondary")}
          />
        </>
      )}
    </Stack>
  );
}
