// ESLint flat config. Style rules are left to Prettier (eslint-config-prettier switches them off);
// `pnpm lint` / `./gradlew :frontend:pnpmLint` run this, `pnpm format` runs Prettier.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import testingLibrary from "eslint-plugin-testing-library";
import vitest from "@vitest/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import globals from "globals";

export default defineConfig([
  globalIgnores(["build/", "node_modules/", ".gradle/"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
    ],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Icons are imported by path (`@mui/icons-material/Edit`): the barrel re-exports ~2000 modules and slows
      // Vite's dev pre-bundling; production output is tree-shaken either way.
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@mui/icons-material", message: "Import icons by path: @mui/icons-material/<Name>." }] },
      ],
    },
  },
  {
    files: ["vite.config.ts", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}", "src/test-setup.ts"],
    extends: [testingLibrary.configs["flat/react"], vitest.configs.recommended],
  },
  eslintConfigPrettier,
]);
