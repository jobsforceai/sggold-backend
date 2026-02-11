import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const configuredKey = env.API_KEY?.trim();
  const isAuthDisabled =
    !configuredKey || configuredKey.length === 0 || configuredKey.toLowerCase() === "replace_me";
  if (isAuthDisabled) return next();

  const incomingKey = req.header("x-api-key");
  if (!incomingKey || incomingKey !== configuredKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
}
