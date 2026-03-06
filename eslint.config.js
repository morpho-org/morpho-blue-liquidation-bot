// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginImportX from "eslint-plugin-import-x";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config({ ignores: ["**/dist/**"] }, eslint.configs.recommended, {
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
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/restrict-template-expressions": ["off"],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    "@typescript-eslint/no-misused-spread": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/prefer-nullish-coalescing": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-unnecessary-type-parameters": "off",
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-empty-function": "off",
    "import-x/no-named-as-default-member": "off",
    "import-x/no-named-as-default": "off",
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
