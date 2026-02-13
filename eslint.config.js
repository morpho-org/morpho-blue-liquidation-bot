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
    "@typescript-eslint/no-unused-vars": [
      "error",
      { ignoreRestSiblings: true, argsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/restrict-template-expressions": "off",
    // Viem ABI types require `any` casts and non-null assertions in iteration patterns
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    // Spreading SDK class instances into plain objects is intentional
    "@typescript-eslint/no-misused-spread": "off",
    // False positives from ABI .find() and config checks
    "@typescript-eslint/no-unnecessary-condition": "off",
    // Used in test mocks and deprecated vitest APIs
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-deprecated": "off",
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
