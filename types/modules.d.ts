declare module "@whoisarpit/supabase-to-zod" {
  /** Converts the generated Supabase types source into Zod schemas source. */
  export function generateZodSchemas(
    inputSource: string,
    outputFile?: string | null,
  ): Promise<string>;
}
