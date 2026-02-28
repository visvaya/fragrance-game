import { z } from "zod";

export const autocompleteSchema = z.object({
  query: z.string().min(1).max(100),
  sessionId: z.uuid().optional(),
});
