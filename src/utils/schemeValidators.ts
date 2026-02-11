import { z } from "zod";

export const enrollSchemeSchema = z.object({
  slabAmountPaise: z.number().int().positive("Invalid slab amount"),
});
