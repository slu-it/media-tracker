import { Button } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useTranslation } from "react-i18next";

/** Plain form POST: the backend deletes the session, clears the cookie and redirects to /login. */
export function LogoutButton() {
  const { t } = useTranslation();
  return (
    <form method="post" action="/logout" style={{ display: "inline" }}>
      <Button type="submit" color="inherit" startIcon={<LogoutIcon />}>
        {t("auth.logout")}
      </Button>
    </form>
  );
}
