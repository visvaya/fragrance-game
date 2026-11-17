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

export default {
  meta: { name: "eauxle" },
  rules: { "restricted-syntax": restrictedSyntax },
};
