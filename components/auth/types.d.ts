declare module "@marsidev/react-turnstile" {
  export type TurnstileInstance = {
    execute: () => void;
    remove: () => void;
    reset: () => void;
  };

  export type TurnstileProperties = {
    onError?: () => void;
    onExpire?: () => void;
    onSuccess?: (token: string) => void;
    options?: {
      action?: string;
      appearance?: "always" | "execute" | "interaction-only";
      cData?: string;
      execution?: "render" | "execute";
      language?: string;
      "response-field"?: boolean;
      "response-field-name"?: string;
      retry?: "auto" | "never";
      "retry-interval"?: number;
      size?: "normal" | "compact" | "invisible";
      tabindex?: number;
      theme?: "light" | "dark" | "auto";
    };
    ref?: React.RefObject<TurnstileInstance | null>;
    siteKey: string;
  };

  export const Turnstile: React.FC<TurnstileProperties>;
}

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
