/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- declaration merging into Vitest's Matchers needs an empty interface, a type alias cannot merge */
// jest-dom 7 extends `Assertion<T>` from Vitest 4. Vitest 5 gives `Assertion` two type
// parameters and expects custom matchers on `Matchers<R, T>`, so the jest-dom matchers are
// attached there. Remove once jest-dom ships Vitest 5 types.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
