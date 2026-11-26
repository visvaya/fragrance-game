declare module "@hookform/resolvers/zod" {
  import type { Resolver } from "react-hook-form";
  import type { ZodType } from "zod";

  type ResolverOptions = {
    rawValues?: boolean;
  };

  export function zodResolver<TFieldValues>(
    schema: ZodType<TFieldValues>,
    schemaOptions?: unknown,
    resolverOptions?: ResolverOptions,
  ): Resolver<TFieldValues>;
}
