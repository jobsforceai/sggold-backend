import { z } from "zod";

export const registerSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
});

export const loginSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});
