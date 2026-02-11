import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const configuredKey = env.ADMIN_API_KEY?.trim();
  if (!configuredKey || configuredKey.length === 0) {
    return res.status(403).json({ message: "Admin access not configured" });
  }

  const incomingKey = req.header("x-admin-key");
  if (!incomingKey || incomingKey !== configuredKey) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
}
