import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { getUserById, loginUser, registerUser } from "../services/authService.js";
import { loginSchema, registerSchema } from "../utils/authValidators.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

export async function registerHandler(req: Request, res: Response) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await registerUser(data);
    res.cookie("sg_token", result.token, COOKIE_OPTIONS);
    return res.status(201).json({ user: result.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    const status = message.includes("already registered") ? 409 : 400;
    return res.status(status).json({ message });
  }
}

export async function loginHandler(req: Request, res: Response) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginUser(data.phone, data.password);
    res.cookie("sg_token", result.token, COOKIE_OPTIONS);
    return res.json({ user: result.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return res.status(401).json({ message });
  }
}

export async function logoutHandler(_req: Request, res: Response) {
  res.clearCookie("sg_token", { path: "/" });
  return res.json({ ok: true });
}

export async function meHandler(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = await getUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user });
}
