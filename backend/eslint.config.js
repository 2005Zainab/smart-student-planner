import eslint from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import { flatConfigs } from "eslint-plugin-import-x";
import globals from "globals";

export default [
  eslint.configs.recommended,
  flatConfigs.recommended,

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      "import-x/no-unresolved": "error",
      "import-x/named": "error",
      "import-x/default": "error",
      "import-x/export": "error",

      "no-use-before-define": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  prettierConfig,
];
