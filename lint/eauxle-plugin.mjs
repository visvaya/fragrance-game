/**
 * Project rules for oxlint, loaded through `jsPlugins` in `.oxlintrc.json`.
 *
 * `restricted-syntax` stands in for ESLint's `no-restricted-syntax`, which oxlint lacks. It takes
 * the same options: a list of `{ selector, message }` entries, where `selector` is an esquery
 * selector. Like the ESLint rule, a later override replaces the whole list for its files.
 */

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
  create(context) {
    return Object.fromEntries(
      context.options.map(({ selector, message }) => [
        selector,
        (node) => context.report({ message, node }),
      ]),
    );
  },
};

const BOUNDING_METHODS = new Set(["limit", "maybeSingle", "single"]);

/** Method name of a call like `x.name(...)`, or undefined for any other node. */
const methodName = (node) =>
  node?.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  !node.callee.computed
    ? node.callee.property.name
    : undefined;

/** Method names of the whole call chain that `call` belongs to, e.g. from, select, eq, limit. */
function chainMethods(call) {
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
const isHeadOnly = (call) =>
  call.arguments[1]?.type === "ObjectExpression" &&
  call.arguments[1].properties.some(
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
  create(context) {
    return {
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

export default {
  meta: { name: "eauxle" },
  rules: {
    "bounded-select": boundedSelect,
    "restricted-syntax": restrictedSyntax,
  },
};
