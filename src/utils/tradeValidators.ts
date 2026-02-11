import { z } from "zod";

export const buySchema = z.object({
  amountMg: z.number().int().min(100, "Minimum buy is 100mg"),
});

export const sellSchema = z.object({
  amountMg: z.number().int().min(1000, "Minimum sell is 1g (1000mg)"),
});
