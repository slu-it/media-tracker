import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import deJson from "./de.json";
import { DEFAULT_LANGUAGE, isLanguage, readStoredLanguage, writeStoredLanguage } from "./language";

// The German bundle must have every key the English one has (missing keys fail the type-check;
// i18n/resources.test.ts additionally checks for stray extra keys).
const de = deJson satisfies typeof en;

const initial = readStoredLanguage() ?? DEFAULT_LANGUAGE;

// initAsync: false makes init() synchronous with inline resources, so the first render (and tests) already
// have translations. No language detector: the stored choice or English, nothing else.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de } },
  lng: initial,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  initAsync: false,
});

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  if (isLanguage(lng)) writeStoredLanguage(lng);
});
document.documentElement.lang = initial;

export default i18n;
