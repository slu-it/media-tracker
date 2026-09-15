import { useState } from "react";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import TranslateIcon from "@mui/icons-material/Translate";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "../../i18n/language";

/** Icon button that opens the language picker. Changing the language re-renders every `t()` in the app. */
export function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const choose = (language: Language) => {
    setAnchor(null);
    void i18n.changeLanguage(language);
  };

  return (
    <>
      <Tooltip title={t("language.label")}>
        <IconButton
          color="inherit"
          aria-label={t("language.label")}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <TranslateIcon />
        </IconButton>
      </Tooltip>
      <Menu open={anchor !== null} anchorEl={anchor} onClose={() => setAnchor(null)}>
        {LANGUAGES.map((language) => (
          <MenuItem key={language} selected={i18n.resolvedLanguage === language} onClick={() => choose(language)}>
            {t(`language.${language}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
