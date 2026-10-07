import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ApiError, errorMessage } from "../../../api/client";
import { changePassword } from "../api/settingsApi";
import { validateCurrentPassword, validateNewPassword, validatePasswordConfirmation } from "../domain/passwordValues";
import { PasswordField } from "./fields/PasswordField";

/** Change the logged-in user's own password (MT-038); other sessions are logged out server-side on success. */
export function PasswordTab() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Bumped on a successful change so the three `PasswordField`s below remount untouched; otherwise each field's
  // own `touched` would survive the reset and show a stale "Required" error under the success alert.
  const [formKey, setFormKey] = useState(0);

  const isValid =
    validateCurrentPassword(currentPassword) === null &&
    validateNewPassword(newPassword) === null &&
    validatePasswordConfirmation(newPassword, confirmation) === null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    setError(null);
    setWrongPassword(false);
    setSuccess(false);
    if (!isValid) return;

    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setShowErrors(false);
      setSuccess(true);
      setFormKey((key) => key + 1);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 403 && cause.body?.error === "wrong_password") {
        setWrongPassword(true);
      } else {
        setError(errorMessage(cause, t("settings.password.failed")));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box component="form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {t("settings.password.hint")}
        </Typography>
        {success && <Alert severity="success">{t("settings.password.success")}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <PasswordField
          key={`current-${formKey}`}
          label={t("settings.password.current")}
          value={currentPassword}
          onChange={(value) => {
            setCurrentPassword(value);
            setWrongPassword(false);
          }}
          validate={validateCurrentPassword}
          autoComplete="current-password"
          disabled={busy}
          showErrors={showErrors}
          externalError={wrongPassword ? t("settings.password.wrongPassword") : null}
        />
        <PasswordField
          key={`new-${formKey}`}
          label={t("settings.password.new")}
          value={newPassword}
          onChange={setNewPassword}
          validate={validateNewPassword}
          autoComplete="new-password"
          disabled={busy}
          showErrors={showErrors}
        />
        <PasswordField
          key={`confirm-${formKey}`}
          label={t("settings.password.confirm")}
          value={confirmation}
          onChange={setConfirmation}
          validate={(value) => validatePasswordConfirmation(newPassword, value)}
          autoComplete="new-password"
          disabled={busy}
          showErrors={showErrors}
        />
        <Box>
          <Button type="submit" variant="contained" disabled={busy}>
            {t("settings.password.submit")}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
