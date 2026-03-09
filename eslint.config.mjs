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
import regexpPlugin from "eslint-plugin-regexp";
import noOnlyTestsPlugin from "eslint-plugin-no-only-tests";
import jsdocPlugin from "eslint-plugin-jsdoc";
import testingLibraryPlugin from "eslint-plugin-testing-library";
import boundariesPlugin from "eslint-plugin-boundaries";
import securityPlugin from "eslint-plugin-security";
import nodePlugin from "eslint-plugin-n";
import betterTailwindPlugin from "eslint-plugin-better-tailwindcss";
import fpPlugin from "eslint-plugin-fp";
import reactWebApiPlugin from "eslint-plugin-react-web-api";

// ── Plugin Documentation ────────────────
/**
 * @plugin perfectionist  - Sortowanie wszystkiego (importy, obiekty, propsy) dla perfekcyjnej czytelności.
 * @plugin unicorn       - Wymuszanie nowoczesnych i bezpiecznych praktyk JS/TS + czyszczenie skrótów.
 * @plugin check-file    - Strażnik spójnego nazewnictwa plików (kebab-case).
 * @plugin sonarjs       - Zaawansowana statyczna analiza pod kątem bugów i długu technicznego.
 * @plugin promise       - Gwarancja poprawnej obsługi operacji asynchronicznych.
 * @plugin regexp        - Ochrona przed niebezpiecznymi i nieefektywnymi wyrażeniami regularnymi.
 * @plugin jsdoc         - Standaryzacja dokumentacji technicznej wewnątrz kodu.
 * @plugin testing-library - Dobre praktyki zapytań RTL i lifecycle testów.
 * @plugin boundaries      - Architektoniczne granice między warstwami aplikacji.
 * @plugin security        - Wykrywanie wzorców podatnych na ataki (ReDoS, eval, injection).
 * @plugin n               - Node.js best practices, deprecated API detection dla route handlers.
 * @plugin better-tailwindcss - Walidacja klas Tailwind v4 — łapie literówki i nieznane klasy.
 * @plugin fp              - Wymuszanie immutable patterns: zakaz mutacji tablic, zakaz `let` poza loopami.
 * @plugin react-web-api   - Wykrywanie wycieków Web API w useEffect: addEventListener, setInterval, setTimeout bez cleanup.
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

// ── Shared no-restricted-properties entries ──────────────────
// Defined once and spread into both section 10 (*.ts) and section 11 (*.tsx)
// to prevent the flat-config last-wins override from silently dropping entries.
const PROCESS_ENV_RESTRICTION = {
  message:
    "Użyj 'import { env } from \"@/lib/env\"' zamiast process.env. Zmienne są walidowane przez Zod.",
  object: "process",
  property: "env",
};

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
  // ║  0. GLOBAL LINTER OPTIONS                                ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    linterOptions: {
      // Auto-detect and report unused eslint-disable directives.
      // Run `eslint --fix` to remove them automatically.
      reportUnusedDisableDirectives: "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  1. GLOBAL IGNORES                                       ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    ignores: [
      // Build & generated
      ".next/**",
      "out/**",
      "dist/**",
      "node_modules/**",
      "types/supabase.ts",
      "reports/**",

      // Test artifacts & coverage
      "coverage/**",
      "test-results/**",
      "playwright-report/**",

      // Config files & Data
      "**/*.json",
      "**/*.yaml",
      "**/*.yml",

      // Cache
      ".ruff_cache/**",
      ".mypy_cache/**",
      ".eslintcache",

      // Supabase Edge Functions (Deno runtime)
      "supabase/functions/**",

      // Data & scripts (non-linted)
      "data/**",
      "scripts/**",
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
      "import-x/no-cycle": ["error", { maxDepth: 5, ignoreExternal: true }],
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              from: "lib/supabase/server.ts",
              message:
                "Server-only klient Supabase nie może być importowany po stronie klienta.",
              target: "components/**",
            },
            {
              from: "lib/supabase/server.ts",
              message:
                "Server-only klient Supabase nie może być importowany po stronie klienta.",
              target: "hooks/**",
            },
          ],
        },
      ],
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
      "@typescript-eslint/naming-convention": [
        "error",
        // Types, interfaces, enums → PascalCase
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["UPPER_CASE", "PascalCase"] },
        // Variables: camelCase, UPPER_CASE (constants), PascalCase (React components)
        // leadingUnderscore: "allow" — konwencja _unused dla nieużywanych zmiennych
        { selector: "variable", format: ["camelCase", "UPPER_CASE", "PascalCase"], leadingUnderscore: "allow" },
        // Destructured variables: any format (Supabase snake_case columns, external APIs)
        { selector: "variable", modifiers: ["destructured"], format: null },
        // Functions: camelCase or PascalCase (for React components)
        { selector: "function", format: ["camelCase", "PascalCase"] },
        // Parameters: camelCase/PascalCase (for React element patterns like `as: Tag`)
        {
          selector: "parameter",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        // Imports and object literal properties: any format (external APIs, Supabase)
        { selector: "import", format: null },
        { selector: "objectLiteralProperty", format: null },
      ],
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          // allow-as-parameter: pozwala w JSX props/function args (np. style={...} as CSSProperties)
          // blokuje `const x = {} as Foo` — wymusza explicit type annotation
          objectLiteralTypeAssertions: "allow-as-parameter",
        },
      ],
      "@typescript-eslint/no-unnecessary-type-parameters": "error",
      "@typescript-eslint/method-signature-style": ["error", "property"],
      "@typescript-eslint/no-shadow": [
        "error",
        {
          // Typy i wartości mogą mieć tę samą nazwę (np. typ `Error` i zmienna `error`)
          ignoreTypeValueShadow: true,
          // Generyczne nazwy parametrów w typach funkcji mogą pokrywać się z zakresem zewnętrznym
          ignoreFunctionTypeParameterNameValueShadow: true,
        },
      ],
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNullableObject: true,   // if (obj) — ok dla nullable obiektów
          allowNullableBoolean: true,  // if (flag) — ok dla boolean | null
          allowNullableString: true,   // if (str) — ok dla string | null
          allowString: true,           // if (str) — ok dla string
          allowNumber: false,          // wymusza if (n > 0) zamiast if (n) — łapie JSX {0 && <X/>}
          allowNullableNumber: false,  // wymusza jawne sprawdzenie dla number | null
          allowNullableEnum: false,
          allowAny: true,              // any z Supabase/external APIs — pokryte przez no-explicit-any
        },
      ],

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

      // ── Env safety — use env from @/lib/env instead of raw process.env ──
      "no-restricted-properties": ["error", PROCESS_ENV_RESTRICTION],

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
  // ║  11. SSR SAFETY — ban hydration-unsafe globals in TSX    ║
  // ║  Math.random() / Date.now() w renderze = hydration bug   ║
  // ║  Zawiera też process.env (nadpisuje sekcję 10 dla tsx)   ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["**/*.tsx"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          message:
            "Math.random() powoduje hydration mismatch w SSR. Użyj w useEffect lub server action.",
          object: "Math",
          property: "random",
        },
        {
          message:
            "Date.now() powoduje hydration mismatch w SSR. Użyj w useEffect lub server action.",
          object: "Date",
          property: "now",
        },
        PROCESS_ENV_RESTRICTION,
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  11c. ENV MODULE EXCEPTION                               ║
  // ║  lib/env.ts musi czytać process.env — to jego jedyne     ║
  // ║  uprawnione miejsce w kodzie aplikacji                    ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["lib/env.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  11b. SERVER COMPONENT SAFETY — ban browser globals      ║
  // ║  window/document/localStorage w Server Components = crash║
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
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "window",
          message: "window jest niedostępne w Server Components. Przenieś do 'use client' lub useEffect.",
        },
        {
          name: "document",
          message: "document jest niedostępne w Server Components. Przenieś do 'use client' lub useEffect.",
        },
        {
          name: "localStorage",
          message: "localStorage jest niedostępne w Server Components. Przenieś do 'use client' lub useEffect.",
        },
        {
          name: "sessionStorage",
          message: "sessionStorage jest niedostępne w Server Components. Przenieś do 'use client' lub useEffect.",
        },
        {
          name: "navigator",
          message: "navigator jest niedostępne w Server Components. Przenieś do 'use client' lub useEffect.",
        },
        {
          name: "fetch",
          message:
            "Użyj fetch z next/server lub odpowiedniego klienta (Supabase, PostHog itp.).",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  12. SERVER COMPONENTS — ban client-side hooks            ║
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
      "proxy.ts",
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
      // Test suites naturalnie mają długie describe/it bloki
      "sonarjs/max-lines-per-function": "off",
      // Loose typing w testach (mockData, any assertions)
      "@typescript-eslint/strict-boolean-expressions": "off",
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  16. TESTING-LIBRARY — React Testing Library best practices ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
    ],
    ignores: ["e2e/**", "tests/e2e/**"],
    plugins: { "testing-library": testingLibraryPlugin },
    rules: {
      ...testingLibraryPlugin.configs.react.rules,
      "testing-library/no-container": "error",
      "testing-library/no-debugging-utils": "warn",
      "testing-library/no-render-in-lifecycle": "error",
      "testing-library/no-unnecessary-act": "warn",
      "testing-library/no-wait-for-multiple-assertions": "error",
      "testing-library/prefer-screen-queries": "error",
      "testing-library/prefer-user-event": "warn",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  17. PLAYWRIGHT — E2E tests                              ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["e2e/**/*.{ts,tsx}", "tests/e2e/**/*.{ts,tsx}"],
    ...playwrightPlugin.configs["flat/recommended"],
    rules: {
      ...playwrightPlugin.configs["flat/recommended"].rules,
      "playwright/expect-expect": "warn",
      "playwright/no-skipped-test": "off",
      "playwright/no-focused-test": "error",
      "playwright/no-wait-for-timeout": "warn",
      "playwright/no-force-option": "warn",
      "playwright/no-networkidle": "warn",
      "playwright/no-conditional-in-test": "off",
      "playwright/no-conditional-expect": "off",
      "playwright/no-standalone-expect": "off", // Disable due to false positives with test.extend
      "playwright/no-wait-for-selector": "warn",
      "sonarjs/no-empty-test-file": "off", // Disable - SonarJS doesn't understand Playwright test declarations
      "sonarjs/fixme-tag": "off",
      "sonarjs/todo-tag": "off",
      "no-console": "off",

      // Relax TS w E2E
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "sonarjs/max-lines-per-function": "off",
      "no-restricted-globals": "off",
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  18. I18N CONFIGURATION — next-intl                       ║
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
      "perfectionist/sort-named-exports": [
        "error",
        { type: "natural", order: "asc" },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  20. UNICORN — modern JS features                         ║
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
      "unicorn/prefer-at": "error",
      "unicorn/no-array-for-each": "error",
      "unicorn/prefer-top-level-await": "warn",
      "unicorn/prefer-string-replace-all": "error",
      "unicorn/no-useless-undefined": "error",
      "unicorn/no-negated-condition": "error",
      "unicorn/prefer-ternary": "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  21. CHECK-FILE — naming conventions                      ║
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
          "components/**/!(__tests__)": "KEBAB_CASE",
          "lib/**/!(__tests__)": "KEBAB_CASE",
          "hooks/**/!(__tests__)": "KEBAB_CASE",
          "app/**/!(__tests__)": "KEBAB_CASE",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  22. SONARJS — code smells & complexity                   ║
  // ╚═══════════════════════════════════════════════════════════╝
  sonarjsPlugin.configs.recommended,
  {
    rules: {
      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/max-lines-per-function": ["error", { maximum: 120 }],
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-identical-functions": "error",
      "sonarjs/prefer-read-only-props": "warn",
      "sonarjs/todo-tag": "warn",
      "sonarjs/fixme-tag": "warn",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  23. PROMISE — async/await best practices                 ║
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
            ArrowFunctionExpression: false,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            FunctionExpression: false,
          },
          contexts: [
            // Eksportowane arrow functions na poziomie modułu
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
          ],
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
        {
          selector:
            "CallExpression[callee.property.name='rpc'][arguments.length>1]:not(:has(CallExpression[callee.property.name=/^(parse|safeParse)$/]))",
          message:
            "❌ Supabase .rpc() z parametrami musi walidować dane przez Zod (.parse lub .safeParse).",
        },
        // ── Supabase .delete() bez filtra ───────────────────────────────────
        // AwaitExpression > CallExpression: '.delete()' jest bezpośrednim dzieckiem await
        // gdy ma filtr (.eq()/.in()/.match()), to .eq() jest bezpośrednim dzieckiem await,
        // a .delete() jest głębiej — selektor go nie flaguje.
        {
          selector:
            "AwaitExpression > CallExpression[callee.property.name='delete']",
          message:
            "❌ Supabase .delete() bez filtra usunie WSZYSTKIE rekordy. Dodaj .eq(), .in() lub .match() przed wywołaniem.",
        },
        // ── px units — użyj rem zamiast px ──────────────────────────────────
        // Łapie arbitralne wartości Tailwind w className, np. text-[10px] → text-[0.625rem]
        {
          selector:
            "JSXAttribute[name.name='className'] > Literal[value=/\\[\\d+(?:\\.\\d+)?px\\]/]",
          message:
            "❌ Użyj rem zamiast px w Tailwind arbitrary values. Przykład: text-[0.625rem] zamiast text-[10px]. Wyjątki: border (1px, 2px) i border-radius (999px) — dodaj eslint-disable z komentarzem.",
        },
        // Łapie template literals: cn(`text-[${n}px]`) i hardcoded className strings ze zmienną
        {
          selector:
            "JSXAttribute[name.name='className'] TemplateLiteral > TemplateElement[value.raw=/\\[\\d+(?:\\.\\d+)?px\\]/]",
          message:
            "❌ Użyj rem zamiast px w Tailwind arbitrary values.",
        },
        // Łapie inline style={{ fontSize: '14px' }}
        {
          selector:
            "JSXAttribute[name.name='style'] ObjectExpression > Property > Literal[value=/^\\d+(?:\\.\\d+)?px$/]",
          message:
            "❌ Użyj rem zamiast px w inline styles. 1rem = 16px. Wyjątki: border (1px) — dodaj eslint-disable z komentarzem.",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  28. SERVER ACTIONS — Zod validation + Supabase safety    ║
  // ║  Nadpisuje sekcję 27 dla plików actions — scala selektory ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["app/actions/**/*.ts", "actions/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        // ── inherited from section 25 (must duplicate — no merge in flat config) ──
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
        // ── Supabase .delete() bez filtra ───────────────────────────────────
        {
          selector:
            "AwaitExpression > CallExpression[callee.property.name='delete']",
          message:
            "❌ Supabase .delete() bez filtra usunie WSZYSTKIE rekordy. Dodaj .eq(), .in() lub .match() przed wywołaniem.",
        },
        // ── Server Actions specific (only functions that accept params) ──
        {
          selector:
            'ExportNamedDeclaration > FunctionDeclaration[params.length>0]:not(:has(CallExpression[callee.name="parse"], CallExpression[callee.property.name="parse"], CallExpression[callee.property.name="safeParse"]))',
          message:
            "Server Actions powinny walidować dane wejściowe (np. Zod .parse/.safeParse).",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  29. BOUNDARIES — Architecture layer separation           ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    plugins: { boundaries: boundariesPlugin },
    settings: {
      "boundaries/elements": [
        { type: "lib", pattern: "lib/**" },
        { type: "types", pattern: "types/**" },
        { type: "hooks", pattern: "hooks/**" },
        { type: "components", pattern: "components/**" },
        { type: "app-actions", pattern: "app/actions/**" },
        { type: "app", pattern: "app/**" },
      ],
      // Resolver potrzebny do mapowania alias @/ i relatywnych importów na ścieżki bezwzględne
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: "lib",
              disallow: ["components", "hooks"],
              message: "lib/ to pure utilities — nie może importować warstwy UI.",
            },
            {
              from: "types",
              disallow: ["components", "hooks", "app-actions", "app"],
              message:
                "types/ to definicje typów — nie może importować z warstw z logiką.",
            },
            {
              from: "app-actions",
              disallow: ["components"],
              message:
                "Server Actions działają po stronie serwera — nie mogą importować komponentów client-only.",
            },
          ],
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  30. EXPLICIT RETURN TYPES — lib/, app/actions/, app/api/ ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: [
      "lib/**/*.ts",
      "app/actions/**/*.ts",
      "app/api/**/route.ts",
    ],
    rules: {
      // Istniejące naruszenia są suppresowane komentarzami — nowe funkcje muszą mieć jawne typy.
      "@typescript-eslint/explicit-module-boundary-types": [
        "error",
        {
          allowArgumentsExplicitlyTypedAsAny: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  31. SECURITY — detect vulnerable code patterns           ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    ...securityPlugin.configs.recommended,
    rules: {
      ...securityPlugin.configs.recommended.rules,
      // false positives przy obj[key] — Zod waliduje na granicach systemu
      "security/detect-object-injection": "off",
      // Pokryte przez eslint-plugin-regexp (regexp/no-super-linear-backtracking)
      "security/detect-non-literal-regexp": "off",
      "security/detect-unsafe-regex": "off",
      // Nieistotne w Next.js (brak Express)
      "security/detect-no-csrf-before-method-override": "off",
      "security/detect-disable-mustache-escape": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  32. SHADCN/UI & UI EXCEPTIONS                             ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      "sonarjs/prefer-read-only-props": "off",
      "import-x/no-named-as-default-member": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  33. E2E TEST OVERRIDES — after SonarJS                  ║
  // ║  Overrides must come after the conflicting global rules   ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["e2e/**/*.{ts,tsx}", "tests/e2e/**/*.{ts,tsx}"],
    rules: {
      // TODO/FIXME comments in E2E test files are expected (known issues, workarounds)
      "sonarjs/fixme-tag": "off",
      "sonarjs/todo-tag": "off",
      "sonarjs/max-lines-per-function": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  34. ALL-TEST OVERRIDES — after SonarJS (must be last)   ║
  // ║  SonarJS section (22) overrides Vitest section (15)      ║
  // ║  so we need a later override for test-specific relaxing   ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
      "vitest.setup.ts",
    ],
    rules: {
      // Test suites mają naturalnie długie describe/it bloki
      "sonarjs/max-lines-per-function": "off",
      // Loose typing w testach (mock data, any assertions)
      "@typescript-eslint/strict-boolean-expressions": "off",
      // Testy używają fikcyjnych klas (foo, bar, baz) — nie są to klasy Tailwind
      "better-tailwindcss/no-unknown-classes": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  35. NODE.js — API route handlers (eslint-plugin-n)      ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["app/api/**/route.ts"],
    plugins: { n: nodePlugin },
    rules: {
      "n/no-deprecated-api": "error",
      "n/no-process-exit": "error",
      "n/no-sync": "warn",
      "n/prefer-global/buffer": ["error", "always"],
      "n/prefer-global/process": ["error", "always"],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  36. BETTER-TAILWINDCSS — validate Tailwind v4 classes  ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindPlugin },
    settings: {
      "better-tailwindcss": {
        entryPoint: "app/globals.css",
      },
    },
    rules: {
      // Wykrywa nieznane klasy Tailwind (literówki, usunięte klasy itp.)
      "better-tailwindcss/no-unknown-classes": "warn",
      // Wykrywa duplikaty klas w className
      "better-tailwindcss/no-duplicate-classes": "error",
      // Spójne sortowanie klas (spójność — warn żeby nie blokować na start)
      "better-tailwindcss/enforce-consistent-class-order": "warn",
      // Skróty: np. px-2 py-2 → p-2
      "better-tailwindcss/enforce-shorthand-classes": "error",
      // Konflikty: np. text-red-500 text-blue-500 jednocześnie
      "better-tailwindcss/no-conflicting-classes": "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  37. FP — immutability enforcement                        ║
  // ║  Wymusza wzorce immutable: spread zamiast mutacji         ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**",
      "e2e/**",
    ],
    plugins: { fp: fpPlugin },
    rules: {
      // Zakaz mutujących metod tablic (push, pop, splice, sort, reverse itp.)
      // warn zamiast error — stopniowa migracja do immutable patterns
      "fp/no-mutating-methods": "error",
      // Zakaz Object.assign() na istniejącym obiekcie (użyj spread)
      "fp/no-mutation": [
        "error",
        {
          commonjs: false,
          allowThis: false,
          exceptions: [
            { object: "module", property: "exports" },
            // Supabase response objects — przypisanie do zmiennych lokalnych
            { property: "current" },
          ],
        },
      ],
      // Zakaz delete — użyj spread z Omit<>
      "fp/no-delete": "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  38. REACT WEB API — detect useEffect lifecycle leaks    ║
  // ║  Wykrywa wycieki: addEventListener, setInterval,         ║
  // ║  setTimeout bez cleanup w useEffect                      ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**",
      "e2e/**",
    ],
    plugins: { "react-web-api": reactWebApiPlugin },
    rules: {
      // addEventListener bez removeEventListener w cleanup
      "react-web-api/no-leaked-event-listener": "error",
      // setInterval bez clearInterval w cleanup
      "react-web-api/no-leaked-interval": "error",
      // setTimeout bez clearTimeout w cleanup (warn — częściej uzasadniony one-shot)
      "react-web-api/no-leaked-timeout": "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  39. PRETTIER — disable conflicting formatting rules     ║
  // ║  (MUST BE LAST!)                                         ║
  // ╚═══════════════════════════════════════════════════════════╝
  // eslint-config-prettier wyłącza reguły ESLint, które mogą kolidować
  // z Prettier (np. indent, quotes, semi). Prettier zajmuje się formatowaniem,
  // ESLint zajmuje się logiką i jakością kodu.
  prettierConfig,
);
