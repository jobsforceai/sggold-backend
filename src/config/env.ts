import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/sggold"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  DATA_PROVIDER_MODE: z.enum(["mock", "alpha_vantage", "gold_api", "auto"]).default("auto"),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  GOLD_API_KEY: z.string().optional(),
  API_KEY: z.string().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().default(30),
  LIVE_CACHE_TTL_SECONDS: z.coerce.number().default(3600),
  HISTORICAL_CACHE_TTL_SECONDS: z.coerce.number().default(86400),
  JWT_SECRET: z.string().default("dev-secret-change-in-production"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ADMIN_API_KEY: z.string().optional(),
  ADMIN_ORIGIN: z.string().default("http://localhost:3001"),
  SAGENEX_API_URL: z.string().default("https://api.sagenex.com/api/v1"),
  SAGENEX_API_KEY: z.string().optional()
});

export const env = envSchema.parse(process.env);
