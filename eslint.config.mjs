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
 * @plugin perfectionist  - Sort everything (imports, objects, props) for maximum readability.
 * @plugin unicorn       - Enforce modern and safe JS/TS practices + clean up abbreviations.
 * @plugin check-file    - Guard consistent file naming conventions (kebab-case).
 * @plugin sonarjs       - Advanced static analysis for bugs and tech debt.
 * @plugin promise       - Guarantee correct async/await patterns.
 * @plugin regexp        - Protect against dangerous and inefficient regular expressions.
 * @plugin jsdoc         - Standardize technical documentation inside the code.
 * @plugin jsx-a11y       - Accessibility rules for JSX (WCAG AA enforcement).
 * @plugin testing-library - RTL query best practices and lifecycle safety.
 * @plugin boundaries      - Architectural layer boundaries between application layers.
 * @plugin security        - Detect patterns vulnerable to attacks (ReDoS, eval, injection).
 * @plugin n               - Node.js best practices, deprecated API detection for route handlers.
 * @plugin better-tailwindcss - Validate Tailwind v4 classes — catches typos and unknown classes.
 * @plugin fp              - Enforce immutable patterns: no array mutations, no `let` outside loops.
 * @plugin react-web-api   - Detect Web API leaks in useEffect: addEventListener, setInterval, setTimeout without cleanup.
 */

// @next/eslint-plugin-next does not support ESM/flat config yet
const require = createRequire(import.meta.url);
const nextPlugin = require("@next/eslint-plugin-next");
const DEPRECATED_REACT_IMPORTS = [
  {
    name: "react",
    importNames: ["forwardRef"],
    message:
      "React 19 handles ref as a prop. Use ref directly instead of forwardRef.",
  },
];

// ── Shared no-restricted-properties entries ──────────────────
// Defined once and spread into both section 10 (*.ts) and section 11 (*.tsx)
// to prevent the flat-config last-wins override from silently dropping entries.
const PROCESS_ENV_RESTRICTION = {
  message:
    "Use 'import { env } from \"@/lib/env\"' instead of process.env. Variables are validated by Zod.",
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

      // Config files & data
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
      ".dependency-cruiser.js",
      "report/html/js/prism.js",
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
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true },
      ],
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
  // ║  Auto-memoization — replaces manual useMemo/useCallback  ║
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
  {
    // Radix UI / Shadcn primitives manage their own ARIA roles and keyboard interactions.
    // These rules fire on wrapper divs that are already correctly handled by the primitives.
    rules: {
      // Radix fully manages focus; our wrapper elements are not the actual interactive elements
      "jsx-a11y/no-autofocus": "off",
    },
  },

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
                "Server-only Supabase client cannot be imported on the client side.",
              target: "components/**",
            },
            {
              from: "lib/supabase/server.ts",
              message:
                "Server-only Supabase client cannot be imported on the client side.",
              target: "hooks/**",
            },
          ],
        },
      ],
      "import-x/consistent-type-specifier-style": "off",
      "@typescript-eslint/no-import-type-side-effects": "off",
      "import-x/no-default-export": "error",
      // TypeScript handles this itself
      "import-x/no-unresolved": "off",
      "import-x/named": "off",
      // Catch imports from packages not declared in package.json
      // devDependencies are allowed in test, config, and e2e files
      "import-x/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: [
            "**/*.test.{ts,tsx}",
            "**/*.spec.{ts,tsx}",
            "**/__tests__/**",
            "vitest.setup.ts",
            "e2e/**",
            "*.config.*",
            "eslint.config.mjs",
          ],
        },
      ],
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
      "@typescript-eslint/no-unnecessary-condition": "error",
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
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
        },
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
          // allow-as-parameter: allows in JSX props/function args (e.g. style={...} as CSSProperties)
          // blocks `const x = {} as Foo` — enforces explicit type annotation
          objectLiteralTypeAssertions: "allow-as-parameter",
        },
      ],
      "@typescript-eslint/no-unnecessary-type-parameters": "error",
      "@typescript-eslint/method-signature-style": ["error", "property"],
      "@typescript-eslint/no-shadow": [
        "error",
        {
          // Types and values can share a name (e.g. type `Error` and variable `error`)
          ignoreTypeValueShadow: true,
          // Generic param names in function types may overlap with outer scope names
          ignoreFunctionTypeParameterNameValueShadow: true,
        },
      ],
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNullableObject: true, // if (obj) — ok for nullable objects
          allowNullableBoolean: true, // if (flag) — ok for boolean | null
          allowNullableString: true, // if (str) — ok for string | null
          allowString: true, // if (str) — ok for string
          allowNumber: false, // enforces if (n > 0) instead of if (n) — catches JSX {0 && <X/>}
          allowNullableNumber: false, // requires explicit check for number | null
          allowNullableEnum: false,
          allowAny: true, // any from Supabase/external APIs — covered by no-explicit-any
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
      // Array index as key causes wrong reconciliation when list items are reordered
      // warn (not error): static lists where order never changes are fine
      "react/no-array-index-key": "warn",
      // dangerouslySetInnerHTML is an XSS vector; always use a sanitiser or avoid entirely
      "react/no-danger": "error",
      // Components defined inside render create a new instance on every render (React perf bug)
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],

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
      // Enforce template literals over string concatenation (FP + readability)
      "prefer-template": "error",
      // Prevent reassigning function parameters — catches subtle mutation bugs in FP code
      // props: false — allow property access on params (event.preventDefault() is fine)
      "no-param-reassign": ["error", { props: false }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Use fetch from next/server or the appropriate client (Supabase, PostHog, etc.).",
        },
      ],
      // Catch usages of APIs marked @deprecated in JSDoc (libraries, internal utils)
      "@typescript-eslint/no-deprecated": "warn",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  10b. ROOT LAYOUT EXCEPTION                              ║
  // ║  layout.tsx uses dangerouslySetInnerHTML for static       ║
  // ║  blocking inline scripts that prevent FOUC.              ║
  // ║  Content is a hardcoded string literal — zero XSS risk.  ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["app/**/layout.tsx"],
    rules: {
      // Blocking scripts in <head> prevent FOUC (flash of unstyled/wrong-theme content).
      // The __html value is a static string literal — no user input, no XSS surface.
      "react/no-danger": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  11. SSR SAFETY — ban hydration-unsafe globals in TSX    ║
  // ║  Math.random() / Date.now() in render = hydration bug    ║
  // ║  Also overrides process.env (overrides section 10 for tsx) ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["**/*.tsx"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          message:
            "Math.random() causes hydration mismatch in SSR. Use inside useEffect or a server action.",
          object: "Math",
          property: "random",
        },
        {
          message:
            "Date.now() causes hydration mismatch in SSR. Use inside useEffect or a server action.",
          object: "Date",
          property: "now",
        },
        PROCESS_ENV_RESTRICTION,
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  11c. ENV MODULE EXCEPTION                               ║
  // ║  lib/env.ts is the one authorised place to read          ║
  // ║  process.env directly in application code.              ║
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
          message:
            "window is not available in Server Components. Move to 'use client' or useEffect.",
        },
        {
          name: "document",
          message:
            "document is not available in Server Components. Move to 'use client' or useEffect.",
        },
        {
          name: "localStorage",
          message:
            "localStorage is not available in Server Components. Move to 'use client' or useEffect.",
        },
        {
          name: "sessionStorage",
          message:
            "sessionStorage is not available in Server Components. Move to 'use client' or useEffect.",
        },
        {
          name: "navigator",
          message:
            "navigator is not available in Server Components. Move to 'use client' or useEffect.",
        },
        {
          name: "fetch",
          message:
            "Use fetch from next/server or the appropriate client (Supabase, PostHog, etc.).",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  11d. NO DIRECT useEffect                                 ║
  // ║  Use useMountEffect() for empty-dep effects.             ║
  // ║  For dep effects: extract to named hook or eslint-disable ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["**/*.tsx", "**/*.ts"],
    ignores: ["lib/hooks/use-mount-effect.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...DEPRECATED_REACT_IMPORTS,
            {
              name: "react",
              importNames: ["useEffect"],
              message:
                "Direct useEffect is banned. " +
                "Use useMountEffect() for mount-only effects (empty deps), " +
                "or extract to a named custom hook. " +
                "If neither applies, add eslint-disable with a category comment.",
            },
          ],
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
                'This file is a Server Component. Move client hooks to a "use client" component.',
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

      // Tests can be looser with types
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/unbound-method": "off",
      "no-restricted-globals": "off",

      // Good test practices
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
      // Test suites naturally have long describe/it blocks
      "sonarjs/max-lines-per-function": "off",
      // Loose typing in tests (mock data, any assertions)
      "@typescript-eslint/strict-boolean-expressions": "off",
      // Tests need object-literal casts for mocks ({} as Foo), but still enforce "as" style (no angle brackets)
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "allow",
        },
      ],
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-shadow": "error",
      "vitest/no-conditional-expect": "error",

      // ── Vitest test quality ──
      // Prefer .mockResolvedValue(x) over .mockImplementation(() => Promise.resolve(x))
      "vitest/prefer-mock-promise-shorthand": "error",
      // Prevent accidentally importing 'node:test' instead of Vitest
      "vitest/no-import-node-test": "error",

      // ── False-positive suppressions (test context) ──
      // TypeScript requires explicit undefined in Vitest mocks (TS2554: Expected 1 argument)
      // but unicorn considers it "useless". Disable only for function call arguments.
      "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
      // Hardcoded IPs in tests are intentional fixture data — use eslint-disable-next-line when needed
      "sonarjs/no-hardcoded-ip": "warn",
      // Mock objects may intentionally have .then() to simulate thenable/promise behaviour
      "unicorn/no-thenable": "off",
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
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    ignores: ["e2e/**", "tests/e2e/**"],
    plugins: { "testing-library": testingLibraryPlugin },
    rules: {
      ...testingLibraryPlugin.configs.react.rules,
      // warn (not error): gradual migration — new tests should prefer getByRole, existing fixed incrementally
      "testing-library/no-node-access": "warn",
      // warn (not error): userEvent requires significant test restructuring; migrate new tests first
      "testing-library/prefer-user-event": "warn",
      "testing-library/no-unnecessary-act": "error",
      // Disallow querying via container.querySelector; use screen queries instead
      "testing-library/no-container": "error",
      // Warn on debug(), logRoles() etc. left in committed code
      "testing-library/no-debugging-utils": "warn",
      // warn (not error): many existing suites render in beforeEach for DRY setup
      "testing-library/no-render-in-lifecycle": "warn",
      // Multiple expects inside waitFor() can hide failures — use separate waitFor calls
      "testing-library/no-wait-for-multiple-assertions": "error",
      // Enforce screen.getByRole over destructuring render result
      "testing-library/prefer-screen-queries": "error",
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
      "sonarjs/no-empty-test-file": "off", // SonarJS doesn't understand Playwright test declarations
      "sonarjs/fixme-tag": "off",
      "sonarjs/todo-tag": "off",
      "no-console": "off",

      // Relax TS in E2E
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "sonarjs/max-lines-per-function": "off",
      // E2E helpers need object casts for Playwright fixtures; still enforce "as" style
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "allow",
        },
      ],
      "@typescript-eslint/no-empty-function": "error",
      "no-restricted-globals": "off",
      // Playwright can't use @/lib/env — allow direct process.env access
      "no-restricted-properties": "off",
      // E2E setup/teardown writes to paths derived from import.meta.url — safe, not user-controlled
      "security/detect-non-literal-fs-filename": "off",
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
      "unicorn/prefer-global-this": "error",
      "unicorn/no-unreadable-array-destructuring": "error",
      // off: React colocation — inner helpers that don't close over state are intentionally kept inside components
      "unicorn/consistent-function-scoping": "off",
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
            // Exported arrow functions at module level
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
  // ║  27. CUSTOM SUPABASE & ZOD RULES                          ║
  // ║  Data safety and query performance guardrails             ║
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
            "❌ Supabase .select() without .limit() is a security risk. Always add a limit.",
        },
        {
          selector:
            "CallExpression[callee.property.name='select'][arguments.0.value='*']",
          message:
            "❌ Avoid select('*'). Choose specific columns for better performance and security.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(fetch|axios|got)$/]:not(:has(CallExpression[callee.property.name=/^(parse|safeParse)$/]))",
          message:
            "❌ Data from APIs must be validated by Zod (.parse() or .safeParse()).",
        },
        {
          selector:
            "CallExpression[callee.property.name='rpc'][arguments.length>1]:not(:has(CallExpression[callee.property.name=/^(parse|safeParse)$/]))",
          message:
            "❌ Supabase .rpc() with params must validate data with Zod (.parse or .safeParse).",
        },
        // ── Supabase .delete() without a filter ─────────────────────────────
        // AwaitExpression > CallExpression: '.delete()' is a direct child of await
        // when a filter (.eq()/.in()/.match()) is present, .eq() is the direct child of await
        // and .delete() is deeper — the selector does not flag it.
        {
          selector:
            "AwaitExpression > CallExpression[callee.property.name='delete']",
          message:
            "❌ Supabase .delete() without a filter will delete ALL records. Add .eq(), .in() or .match() first.",
        },
        // ── px units — use rem instead of px ────────────────────────────────
        // Catches arbitrary Tailwind values in className, e.g. text-[10px] → text-[0.625rem]
        {
          selector:
            "JSXAttribute[name.name='className'] > Literal[value=/\\[\\d+(?:\\.\\d+)?px\\]/]",
          message:
            "❌ Use rem instead of px in Tailwind arbitrary values. Example: text-[0.625rem] instead of text-[10px]. Exceptions: border (1px, 2px) and border-radius (999px) — add eslint-disable with a comment.",
        },
        // Catches template literals: cn(`text-[${n}px]`) and hardcoded className strings with a variable
        {
          selector:
            "JSXAttribute[name.name='className'] TemplateLiteral > TemplateElement[value.raw=/\\[\\d+(?:\\.\\d+)?px\\]/]",
          message: "❌ Use rem instead of px in Tailwind arbitrary values.",
        },
        // Catches inline style={{ fontSize: '14px' }}
        {
          selector:
            "JSXAttribute[name.name='style'] ObjectExpression > Property > Literal[value=/^\\d+(?:\\.\\d+)?px$/]",
          message:
            "❌ Use rem instead of px in inline styles. 1rem = 16px. Exceptions: border (1px) — add eslint-disable with a comment.",
        },
      ],
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  28. SERVER ACTIONS — Zod validation + Supabase safety    ║
  // ║  Overrides section 27 for action files — must duplicate   ║
  // ║  selectors (flat config has no rule merging).             ║
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
            "❌ Supabase .select() without .limit() is a security risk. Always add a limit.",
        },
        {
          selector:
            "CallExpression[callee.property.name='select'][arguments.0.value='*']",
          message:
            "❌ Avoid select('*'). Choose specific columns for better performance and security.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(fetch|axios|got)$/]:not(:has(CallExpression[callee.property.name=/^(parse|safeParse)$/]))",
          message:
            "❌ Data from APIs must be validated by Zod (.parse() or .safeParse()).",
        },
        // ── Supabase .delete() without a filter ─────────────────────────────
        {
          selector:
            "AwaitExpression > CallExpression[callee.property.name='delete']",
          message:
            "❌ Supabase .delete() without a filter will delete ALL records. Add .eq(), .in() or .match() first.",
        },
        // ── Server Actions specific (only functions that accept params) ──
        {
          selector:
            'ExportNamedDeclaration > FunctionDeclaration[params.length>0]:not(:has(CallExpression[callee.name="parse"], CallExpression[callee.property.name="parse"], CallExpression[callee.property.name="safeParse"]))',
          message:
            "Server Actions should validate inputs (e.g. Zod .parse/.safeParse).",
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
      // Resolver needed to map the @/ alias and relative imports to absolute paths
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
              message:
                "lib/ is pure utilities — it must not import from the UI layer.",
            },
            {
              from: "types",
              disallow: ["components", "hooks", "app-actions", "app"],
              message:
                "types/ holds type definitions — it must not import from layers with business logic.",
            },
            {
              from: "app-actions",
              disallow: ["components"],
              message:
                "Server Actions run on the server — they must not import client-only components.",
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
    files: ["lib/**/*.ts", "app/actions/**/*.ts", "app/api/**/route.ts"],
    rules: {
      // Existing violations are suppressed by inline comments — new functions must have explicit types.
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
      // false positives on obj[key] — Zod validates at system boundaries
      "security/detect-object-injection": "off",
      // Covered by eslint-plugin-regexp (regexp/no-super-linear-backtracking)
      "security/detect-non-literal-regexp": "off",
      "security/detect-unsafe-regex": "off",
      // Not relevant in Next.js (no Express)
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
      // E2E setup/teardown writes to paths derived from import.meta.url — safe, not user-controlled
      "security/detect-non-literal-fs-filename": "off",
      // Playwright uses locators in expressions (e.g., (await loc.first()).click())
      "unicorn/no-await-expression-member": "off",
      // Runtime-conditional skips (`test.skip(condition, reason)`, e.g. the game is
      // closed or a service key is missing) are Playwright API; the rule reads them as
      // permanently ignored tests.
      "sonarjs/no-skipped-tests": "off",
      // Specs that declare tests through test.extend fixtures (e.g. mobileAndroidTest)
      // look empty to the rule, which only recognises test() calls.
      "sonarjs/no-empty-test-file": "off",
      // DEBT (sonarjs 4 upgrade): about 30 fixed waits and 4 networkidle waits in
      // e2e/ should become web-first assertions. Tracked in docs/known-debt.md.
      "sonarjs/no-fixed-wait-in-tests": "off",
      "sonarjs/no-networkidle-wait": "off",
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
      // Test suites naturally have long describe/it blocks
      "sonarjs/max-lines-per-function": "off",
      // Loose typing in tests (mock data, any assertions)
      "@typescript-eslint/strict-boolean-expressions": "off",
      // Tests need object-literal casts for mocks; still enforce "as" style
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "allow",
        },
      ],
      // vi.importMock<typeof import("@/lib/...")>() is a Vitest-specific pattern — allow inline import() types
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      // Tests use placeholder class names (foo, bar, baz) — not Tailwind classes
      "better-tailwindcss/no-unknown-classes": "off",
      // Style preference (it.each); separate named tests read better in failure output
      "sonarjs/parameterized-tests": "off",
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
      // Detect unknown Tailwind classes (typos, removed classes, etc.)
      "better-tailwindcss/no-unknown-classes": "warn",
      // Detect duplicate class names in className
      "better-tailwindcss/no-duplicate-classes": "error",
      // Consistent class ordering (warn to avoid noise on initial adoption)
      "better-tailwindcss/enforce-consistent-class-order": "warn",
      // Shorthand merging: e.g. px-2 py-2 → p-2
      "better-tailwindcss/enforce-shorthand-classes": "error",
      // Conflicts: e.g. text-red-500 text-blue-500 simultaneously
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
      // Prohibit mutating array methods (push, pop, splice, sort, reverse, etc.)
      "fp/no-mutating-methods": "error",
      // Prohibit Object.assign() on an existing object (use spread instead)
      "fp/no-mutation": [
        "error",
        {
          commonjs: false,
          allowThis: false,
          exceptions: [
            { object: "module", property: "exports" },
            // Supabase response objects — assignment to local variables
            { property: "current" },
          ],
        },
      ],
      // Prohibit delete — use spread with Omit<>
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
      // addEventListener without removeEventListener in cleanup
      "react-web-api/no-leaked-event-listener": "error",
      // setInterval without clearInterval in cleanup
      "react-web-api/no-leaked-interval": "error",
      // setTimeout without clearTimeout in cleanup (one-shot patterns are often intentional)
      "react-web-api/no-leaked-timeout": "error",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  39a. AUTH COMPONENTS — fp/no-mutating-methods overrides ║
  // ║  router.push() and form.watch() are false positives:     ║
  // ║  the rule flags any .push()/.watch() regardless of the  ║
  // ║  object type (array vs Next.js router / react-hook-form) ║
  // ╚═══════════════════════════════════════════════════════════╝
  {
    files: ["components/auth/**/*.{ts,tsx}"],
    plugins: { fp: fpPlugin },
    rules: {
      // router.push() is Next.js navigation — not an array mutation.
      // form.watch() is react-hook-form subscription — not an array mutation.
      // fp/no-mutating-methods cannot distinguish object types, so false positives.
      "fp/no-mutating-methods": "off",
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║  40. PRETTIER — disable conflicting formatting rules     ║
  // ║  (MUST BE LAST!)                                         ║
  // ╚═══════════════════════════════════════════════════════════╝
  // eslint-config-prettier disables ESLint rules that can conflict with Prettier
  // (e.g. indent, quotes, semi). Prettier handles formatting; ESLint handles logic and code quality.
  prettierConfig,
);
