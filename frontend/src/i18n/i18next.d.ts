import type en from "./en.json";

// Typed translation keys: `t("games.addGame")` compiles, `t("games.addGmae")` does not.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}
