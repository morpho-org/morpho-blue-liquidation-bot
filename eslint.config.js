// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginImportX from "eslint-plugin-import-x";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config({ ignores: ["dist"] }, eslint.configs.recommended, {
  extends: [
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    eslintPluginImportX.flatConfigs.recommended,
    eslintPluginImportX.flatConfigs.typescript,
    eslintPluginPrettierRecommended,
  ],
  files: ["**/*.ts"],
  languageOptions: {
    ecmaVersion: 2022,
    parser: tseslint.parser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    "@typescript-eslint/restrict-template-expressions": ["off"],
    "import-x/no-unresolved": [
      "error",
      { ignore: ["ponder:api", "ponder:registry", "ponder:schema"] },
    ],
    "import-x/order": [
      "error",
      {
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
        pathGroups: [
          {
            pattern: "ponder*",
            group: "external",
          },
        ],
      },
    ],
  },
});
