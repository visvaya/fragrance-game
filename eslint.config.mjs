// eslint.config.mjs
// ═══════════════════════════════════════════════════════════════
//  ESLint 9 Flat Config
// ═══════════════════════════════════════════════════════════════

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactCompilerPlugin from "eslint-plugin-react-compiler";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import importXPlugin from "eslint-plugin-import-x";
import vitestPlugin from "@vitest/eslint-plugin";
import playwrightPlugin from "eslint-plugin-playwright";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import { fixupPluginRules } from "@eslint/compat";
import { createRequire } from "module";
import perfectionistPlugin from "eslint-plugin-perfectionist";
import unicornPlugin from "eslint-plugin-unicorn";
import checkFilePlugin from "eslint-plugin-check-file";
import sonarjsPlugin from "eslint-plugin-sonarjs";
import promisePlugin from "eslint-plugin-promise";
import reactRefreshPlugin from "eslint-plugin-react-refresh";
import regexpPlugin from "eslint-plugin-regexp";
import noOnlyTestsPlugin from "eslint-plugin-no-only-tests";
import jsdocPlugin from "eslint-plugin-jsdoc";

// ── Plugin Documentation ────────────────
/**
 * @plugin perfectionist  - Sortowanie wszystkiego (importy, obiekty, propsy) dla perfekcyjnej czytelności.
 * @plugin unicorn       - Wymuszanie nowoczesnych i bezpiecznych praktyk JS/TS + czyszczenie skrótów.
 * @plugin check-file    - Strażnik spójnego nazewnictwa plików (kebab-case).
 * @plugin sonarjs       - Zaawansowana statyczna analiza pod kątem bugów i długu technicznego.
 * @plugin promise       - Gwarancja poprawnej obsługi operacji asynchronicznych.
 * @plugin regexp        - Ochrona przed niebezpiecznymi i nieefektywnymi wyrażeniami regularnymi.
 * @plugin jsdoc         - Standaryzacja dokumentacji technicznej wewnątrz kodu.
 */

// @next/eslint-plugin-next does not support ESM/flat config yet
const require = createRequire(import.meta.url);
const nextPlugin = require("@next/eslint-plugin-next");
const DEPRECATED_REACT_IMPORTS = [
  {
    name: "react",
    importNames: ["forwardRef"],
    message:
      "React 19 obsługuje ref jako prop. Użyj ref bezpośrednio zamiast forwardRef.",
  },
];

// ── Hooks banned in Server Components ───────────────────────
const CLIENT_ONLY_HOOKS = [
  "useState",
  "useEffect",
  "useReducer",
  "useRef",
  "useCallback",
  "useMemo",
  "useLayoutEffect",
  "useInsertionEffect",
  "useSyncExternalStore",
];

export default tseslint.config(
  // ╔═══════════════════════════════════════════════════════════╗
  // ║  1. GLOBAL IGNORES                                       ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    ignores: [
      // Build & generated
      ".next/**",
      "out/**",
      "node_modules/**",
      ".next/*",
      "out/*",
      "dist/*",
      "types/supabase.ts",
      "reports/*",

      // Test artifacts & coverage
      "coverage/**",
      "test-results/**",
      "playwright-report/**",

      // Config files & Data
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "reports/**",

      // Cache
      ".ruff_cache/**",
      ".mypy_cache/**",
      ".eslintcache",

      // Supabase Edge Functions (Deno runtime)
      "supabase/functions/**",

      // Data & scripts (non-linted)
      "data/**",
      "scripts/**/*.py",
      "scripts/**/*.sql",
      "img/**",

      // Config & auto-generated (handled in section 17)
      ".sentryrc",
      "*.config.*",
      ".prettierrc.*",
      "postcss.config.*",
      "sentry.*.config.ts",
      "instrumentation.ts",
    ],
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  2. BASE — JavaScript recommended                        ║
  // ╚═══════════════════════════════════════════════════════════╝
  js.configs.recommended,

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  3. TYPESCRIPT — strict + stylistic (type-checked)       ║
  // ╚═══════════════════════════════════════════════════════════╝
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  4. REACT 19 + JSX Runtime                               ║
  // ╚═══════════════════════════════════════════════════════════╝
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  {
    settings: {
      react: { version: "detect" },
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  5. REACT HOOKS                                          ║
  // ╚═══════════════════════════════════════════════════════════╝
  reactHooksPlugin.configs["recommended-latest"],

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  6. REACT COMPILER                                       ║
  // ║  Automatyczna memoizacja — zastępuje useMemo/useCallback ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    plugins: { "react-compiler": reactCompilerPlugin },
    rules: {
      "react-compiler/react-compiler": "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  7. JSX ACCESSIBILITY                                    ║
  // ╚═══════════════════════════════════════════════════════════╝
  jsxA11yPlugin.flatConfigs.recommended,

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  8. NEXT.js 16                                           ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    plugins: { "@next/next": fixupPluginRules(nextPlugin) },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  9. IMPORT ORGANIZATION (import-x)                       ║
  // ╚═══════════════════════════════════════════════════════════╝
  importXPlugin.flatConfigs.recommended,
  importXPlugin.flatConfigs.typescript,
  {
    rules: {
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          pathGroups: [
            {
              pattern: "react",
              group: "external",
              position: "before",
            },
            {
              pattern: "next/**",
              group: "external",
              position: "before",
            },
            {
              pattern: "@/*",
              group: "internal",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["react"],
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import-x/no-duplicates": ["error", { "prefer-inline": true }],
      "import-x/consistent-type-specifier-style": "off",
      "@typescript-eslint/no-import-type-side-effects": "off",
      "import-x/no-default-export": "error",
      // TypeScript sam to sprawdza
      "import-x/no-unresolved": "off",
      "import-x/named": "off",
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  10. PROJECT-WIDE CUSTOM RULES                           ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // ── TypeScript refinements ──
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        {
          ignoreConditionalTests: true,
          ignorePrimitives: { string: true },
        },
      ],
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        { allowConstantLoopConditions: true },
      ],
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true },
      ],
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",

      // ── React 19 ──
      "react/prop-types": "off",
      "react/display-name": "off",
      "react/self-closing-comp": "error",
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-curly-brace-presence": [
        "error",
        { props: "never", children: "never" },
      ],
      "react/jsx-no-leaked-render": [
        "error",
        { validStrategies: ["ternary", "coerce"] },
      ],
      "react/hook-use-state": "error",
      "react/jsx-no-useless-fragment": ["error", { allowExpressions: true }],
      "react/no-unknown-property": [
        "error",
        { ignore: ["vaul-drawer-wrapper"] },
      ],
      "react/iframe-missing-sandbox": "error",
      "react/jsx-no-script-url": "error",

      // ── Deprecations & banned patterns ──
      "no-restricted-imports": [
        "error",
        {
          paths: DEPRECATED_REACT_IMPORTS,
        },
      ],

      // ── General ──
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Użyj fetch z next/server lub odpowiedniego klienta (Supabase, PostHog itp.).",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  11. SERVER COMPONENTS — ban client-side hooks            ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: [
      "app/**/page.tsx",
      "app/**/layout.tsx",
      "app/**/loading.tsx",
      "app/**/error.tsx",
      "app/**/not-found.tsx",
      "app/**/template.tsx",
      "app/**/default.tsx",
      "app/**/opengraph-image.tsx",
      "app/**/icon.tsx",
      "app/**/sitemap.ts",
      "app/**/robots.ts",
      "app/**/manifest.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...DEPRECATED_REACT_IMPORTS,
            {
              name: "react",
              importNames: CLIENT_ONLY_HOOKS,
              message:
                'Ten plik to Server Component. Przenieś hooki klienta do komponentu z "use client".',
            },
          ],
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  12. SERVER ACTIONS                                       ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["app/**/actions.ts", "actions/**/*.ts"],
    rules: {
      // Server Actions zawsze powinny walidować input
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            'ExportNamedDeclaration > FunctionDeclaration:not(:has(CallExpression[callee.name="parse"], CallExpression[callee.property.name="parse"], CallExpression[callee.property.name="safeParse"]))',
          message:
            "Server Actions powinny walidować dane wejściowe (np. Zod .parse/.safeParse).",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  13. DEFAULT EXPORT EXCEPTIONS                            ║
  // ║  Next.js wymaga default exportów w specyficznych plikach  ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: [
      "app/**/page.tsx",
      "app/**/layout.tsx",
      "app/**/loading.tsx",
      "app/**/error.tsx",
      "app/**/global-error.tsx",
      "app/**/not-found.tsx",
      "app/**/template.tsx",
      "app/**/default.tsx",
      "app/**/opengraph-image.tsx",
      "app/**/icon.tsx",
      "middleware.ts",
      "instrumentation.ts",
    ],
    rules: {
      "import-x/no-default-export": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  14. API ROUTE HANDLERS                                   ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["app/api/**/route.ts"],
    rules: {
      "import-x/no-default-export": "off",
      // Route handlers mogą potrzebować nieograniczonego fetcha
      "no-restricted-globals": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  15. VITEST — unit/integration tests                      ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
    ],
    plugins: { vitest: vitestPlugin },
    rules: {
      ...vitestPlugin.configs.recommended.rules,

      // Testy mogą być luźniejsze
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/unbound-method": "off",
      "no-restricted-globals": "off",

      // Dobre praktyki testowe
      "vitest/expect-expect": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/no-focused-tests": "error",
      "vitest/valid-title": "error",
      "vitest/consistent-test-it": [
        "error",
        { fn: "it", withinDescribe: "it" },
      ],
      "vitest/no-duplicate-hooks": "error",
      "vitest/prefer-to-be": "error",
      "vitest/prefer-to-have-length": "error",
      "no-console": "off",
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  16. PLAYWRIGHT — E2E tests                              ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["e2e/**/*.{ts,tsx}", "tests/e2e/**/*.{ts,tsx}"],
    ...playwrightPlugin.configs["flat/recommended"],
    rules: {
      ...playwrightPlugin.configs["flat/recommended"].rules,
      "playwright/expect-expect": "error",
      "playwright/no-skipped-test": "warn",
      "playwright/no-focused-test": "error",
      "playwright/no-wait-for-timeout": "warn",
      "playwright/no-force-option": "warn",
      "no-console": "off",

      // Relax TS w E2E
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "no-restricted-globals": "off",
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  17. I18N CONFIGURATION — next-intl                       ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["i18n/**/*.ts", "messages/**/*.json"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "import-x/no-default-export": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  18. PRETTIER — wyłącza kolidujące reguły (ZAWSZE LAST!) ║
  // ╚═══════════════════════════════════════════════════════════╝
  // ╔═══════════════════════════════════════════════════════════╗
  // ║  19. PERFECTIONIST — sorting everything                    ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    plugins: { perfectionist: perfectionistPlugin },
    rules: {
      "perfectionist/sort-imports": "off",
      "perfectionist/sort-named-imports": "off",
      "perfectionist/sort-objects": [
        "error",
        { type: "natural", order: "asc" },
      ],
      "perfectionist/sort-object-types": [
        "error",
        { type: "natural", order: "asc" },
      ],
      "perfectionist/sort-interfaces": [
        "error",
        { type: "natural", order: "asc" },
      ],
      "perfectionist/sort-jsx-props": [
        "error",
        { type: "natural", order: "asc" },
      ],
      "perfectionist/sort-enums": ["error", { type: "natural", order: "asc" }],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  19. UNICORN — modern JS features                         ║
  // ╚═══════════════════════════════════════════════════════════╝
  unicornPlugin.configs["flat/recommended"],
  {
    rules: {
      "unicorn/prevent-abbreviations": [
        "error",
        {
          allowList: {
            props: true,
            ref: true,
            params: true,
            args: true,
            env: true,
            i: true,
            idx: true,
            db: true,
            btn: true,
            msg: true,
            auth: true,
            e: true,
            req: true,
            res: true,
            err: true,
            utils: true,
          },
        },
      ],
      "unicorn/no-null": "off",
      "unicorn/filename-case": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  20. CHECK-FILE — naming conventions                      ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    plugins: { "check-file": checkFilePlugin },
    rules: {
      "check-file/filename-naming-convention": [
        "error",
        {
          "app/**/*.{ts,tsx}": "KEBAB_CASE",
          "components/**/*.{ts,tsx}": "KEBAB_CASE",
          "hooks/**/*.ts": "KEBAB_CASE",
          "lib/**/*.ts": "KEBAB_CASE",
          "types/**/*.ts": "KEBAB_CASE",
          "actions/**/*.ts": "KEBAB_CASE",
        },
        { ignoreMiddleExtensions: true },
      ],
      "check-file/folder-naming-convention": [
        "error",
        {
          "components/**": "KEBAB_CASE",
          "lib/**": "KEBAB_CASE",
          "hooks/**": "KEBAB_CASE",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  21. SONARJS — code smells & complexity                   ║
  // ╚═══════════════════════════════════════════════════════════╝
  sonarjsPlugin.configs.recommended,
  {
    rules: {
      "sonarjs/cognitive-complexity": ["warn", 20],
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-identical-functions": "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  22. PROMISE — async/await best practices                 ║
  // ╚═══════════════════════════════════════════════════════════╝
  promisePlugin.configs["flat/recommended"],
  {
    files: ["app/actions/**/*.ts"],
    rules: {
      "promise/always-return": "off",
      "promise/catch-or-return": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  23. REACT-REFRESH — fast refresh stability               ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    plugins: { "react-refresh": reactRefreshPlugin },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  24. REGEXP — safe regular expressions                    ║
  // ╚═══════════════════════════════════════════════════════════╝
  regexpPlugin.configs["flat/recommended"],

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  25. NO-ONLY-TESTS — prevent focused tests in CI          ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    plugins: { "no-only-tests": noOnlyTestsPlugin },
    rules: {
      "no-only-tests/no-only-tests": "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  26. JSDOC — documentation standards                      ║
  // ╚═══════════════════════════════════════════════════════════╝
  jsdocPlugin.configs["flat/recommended-typescript"],
  {
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-param": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  27. CUSTOM SUPABASE & ZOD RULES                           ║
  // ║  Bezpieczeństwo danych i wydajność zapytań                 ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='select'] > CallExpression[callee.property.name='from']:not(:has(CallExpression[callee.property.name='limit']))",
          message:
            "❌ Supabase .select() bez .limit() to zagrożenie bezpieczeństwa. Zawsze dodawaj limit.",
        },
        {
          selector:
            "CallExpression[callee.property.name='select'][arguments.0.value='*']",
          message:
            "❌ Unikaj select('*'). Wybieraj konkretne kolumny dla lepszej wydajności i bezpieczeństwa.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(fetch|axios|got)$/]:not(:has(CallExpression[callee.property.name=/^(parse|safeParse)$/]))",
          message:
            "❌ Dane z API muszą być walidowane przez Zod (.parse() lub .safeParse()).",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  28. SHADCN/UI & UI EXCEPTIONS                             ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      "sonarjs/prefer-read-only-props": "off",
      "import-x/no-named-as-default-member": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  29. PRETTIER — disable conflicting formatting rules     ║
  // ║  (MUST BE LAST!)                                         ║
  // ╚═══════════════════════════════════════════════════════════╝
  // eslint-config-prettier wyłącza reguły ESLint, które mogą kolidować
  // z Prettier (np. indent, quotes, semi). Prettier zajmuje się formatowaniem,
  // ESLint zajmuje się logiką i jakością kodu.
  prettierConfig,
);
