import { z } from "zod";

export const metalSchema = z.enum(["gold", "silver"]);
export const currencySchema = z.enum(["USD", "INR", "EUR", "GBP", "AED"]).default("INR");
export const rangeSchema = z.enum(["1D", "1W", "1M", "5M", "1Y", "5Y", "10Y"]).default("1D");

export const historicalQuerySchema = z.object({
  currency: currencySchema.optional(),
  range: rangeSchema.optional(),
  points: z.coerce.number().min(10).max(4000).optional()
});
