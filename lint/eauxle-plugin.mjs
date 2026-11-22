/**
 * Project rules for oxlint, loaded through `jsPlugins` in `.oxlintrc.json`.
 *
 * `restricted-syntax` stands in for ESLint's `no-restricted-syntax`, which oxlint lacks. It takes
 * the same options: a list of `{ selector, message }` entries, where `selector` is an esquery
 * selector. Like the ESLint rule, a later override replaces the whole list for its files.
 */

// The plugin API has no usable types here: the ESTree node union makes walking a call chain by
// property name a cast on every line, so nodes and the rule context are typed as any.
/** @typedef {any} AstNode */
/** @typedef {any} RuleContext */

const restrictedSyntax = {
  meta: {
    type: "problem",
    docs: { description: "Report AST nodes that match a restricted selector." },
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          selector: { type: "string" },
          message: { type: "string" },
        },
        required: ["selector", "message"],
        additionalProperties: false,
      },
    },
  },
  /** @param {RuleContext} context */
  create(context) {
    return Object.fromEntries(
      context.options.map(
        /** @param {{ selector: string, message: string }} option */
        ({ selector, message }) => [
          selector,
          /** @param {AstNode} node */
          (node) => context.report({ message, node }),
        ],
      ),
    );
  },
};

const BOUNDING_METHODS = new Set(["limit", "maybeSingle", "single"]);

/** Method name of a call like `x.name(...)`, or undefined for any other node. */
/** @param {AstNode} node */
const methodName = (node) =>
  node?.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  !node.callee.computed
    ? node.callee.property.name
    : undefined;

/** Method names of the whole call chain that `call` belongs to, e.g. from, select, eq, limit. */
/** @param {AstNode} call */
function chainMethods(call) {
  /** @type {string[]} */
  const names = [];
  let lower = call.callee.object;
  while (methodName(lower)) {
    names.push(methodName(lower));
    lower = lower.callee.object;
  }
  let upper = call;
  while (
    upper.parent?.type === "MemberExpression" &&
    upper.parent.object === upper &&
    methodName(upper.parent.parent)
  ) {
    upper = upper.parent.parent;
    names.push(methodName(upper));
  }
  return names;
}

/** `select(columns, { head: true })` returns only a count, never rows. */
/** @param {AstNode} call */
const isHeadOnly = (call) =>
  call.arguments[1]?.type === "ObjectExpression" &&
  call.arguments[1].properties.some(
    /** @param {AstNode} p */
    (p) =>
      p.type === "Property" && p.key.name === "head" && p.value.value === true,
  );

/**
 * `bounded-select`: every Supabase `select()` in a `from()` chain ends with `.limit()`,
 * `.single()` or `.maybeSingle()`, so that a query never returns an unbounded number of rows.
 * The chain is followed through one expression only: a builder kept in a variable
 * (`const q = db.from("t"); q.select("id")`) is not recognised and not reported. The project has
 * no such query today; build each query in one expression.
 */
const boundedSelect = {
  meta: {
    type: "problem",
    docs: { description: "Require a row bound on Supabase select() queries." },
    schema: [],
  },
  /** @param {RuleContext} context */
  create(context) {
    return {
      /** @param {AstNode} node */
      CallExpression(node) {
        if (methodName(node) !== "select" || isHeadOnly(node)) return;
        const methods = chainMethods(node);
        if (
          !methods.includes("from") ||
          methods.some((m) => BOUNDING_METHODS.has(m))
        )
          return;
        context.report({
          message:
            "Supabase select() without .limit(), .single() or .maybeSingle() can return every row. Add a bound to the chain.",
          node,
        });
      },
    };
  },
};

const FUNCTION_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

const HTTP_CLIENTS = new Set(["axios", "fetch", "got"]);

/** Nearest enclosing function (or the Program) of a node. */
/** @param {AstNode} node */
const scopeOf = (node) => {
  let scope = node.parent;
  while (scope && scope.type !== "Program" && !FUNCTION_TYPES.has(scope.type))
    scope = scope.parent;
  return scope;
};

/**
 * `fetch-requires-parse`: a call to `fetch`, `axios` or `got` is reported unless the function it
 * sits in also calls `.parse()` or `.safeParse()` (any receiver), so that data from outside is
 * validated at the boundary with a Zod schema. A parse in a nested callback counts for the
 * functions around it (`fetch(url).then((r) => schema.parse(r))`); a parse in a sibling or an
 * outer function does not. At module scope, only a module-scope parse counts. The rule checks
 * that a parse exists, not that it receives the response.
 */
const fetchRequiresParse = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a .parse() or .safeParse() call in the function that calls fetch.",
    },
    schema: [],
  },
  /** @param {RuleContext} context */
  create(context) {
    /** @type {{ node: AstNode, scope: AstNode }[]} */
    const fetches = [];
    const parsedScopes = new Set();
    return {
      /** @param {AstNode} node */
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          HTTP_CLIENTS.has(node.callee.name)
        ) {
          fetches.push({ node, scope: scopeOf(node) });
        }
        if (["parse", "safeParse"].includes(methodName(node))) {
          const chain = [];
          for (let scope = scopeOf(node); scope; scope = scopeOf(scope)) {
            chain.push(scope);
          }
          // Program counts only for a parse at module scope, not for one inside a function.
          for (const scope of chain) {
            if (scope.type !== "Program" || chain.length === 1)
              parsedScopes.add(scope);
          }
        }
      },
      "Program:exit"() {
        for (const { node, scope } of fetches) {
          if (parsedScopes.has(scope)) continue;
          context.report({
            message:
              "Data from APIs must be validated: parse the response with a Zod schema (.parse() or .safeParse()) in the same function as the fetch.",
            node,
          });
        }
      },
    };
  },
};

export default {
  meta: { name: "eauxle" },
  rules: {
    "bounded-select": boundedSelect,
    "fetch-requires-parse": fetchRequiresParse,
    "restricted-syntax": restrictedSyntax,
    // Same engine, own rule key: a later override replacing the restricted-syntax list cannot drop it.
    "ui-text": restrictedSyntax,
  },
};
