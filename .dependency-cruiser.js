/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular dependency detected. Madge also checks this, but here we can block it in CI.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment:
        "File is not imported by anyone and does not import anything (except types). It may be dead code.",
      from: {
        orphan: true,
        pathNot: [
          "app/api/.*",
          "app/.*/page\\.tsx",
          "app/.*/layout\\.tsx",
          "app/.*/loading\\.tsx",
          "app/.*/error\\.tsx",
          "app/globals\\.css",
          "instrumentation\\.ts",
          "middleware\\.ts",
        ],
      },
      to: {},
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "Import from a non-existent file.",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules|\\.next",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
      archi: {
        collapsePattern:
          "^(packages|src|lib|app|bin|test|spec|node_modules)/[^/]+",
      },
    },
  },
};
