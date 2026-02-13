import type { Request, Response } from "express";
import { enrollScheme, getSchemeDetail, getUserSchemes, payInstallment, redeemScheme } from "../services/schemeService.js";
import { enrollSchemeSchema } from "../utils/schemeValidators.js";

export async function enrollHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const { slabAmountPaise } = enrollSchemeSchema.parse(req.body);
    const sgxCode = typeof req.body.sgxCode === "string" ? req.body.sgxCode.trim() : undefined;
    const scheme = await enrollScheme(req.user.userId, slabAmountPaise, sgxCode || undefined);
    return res.status(201).json({ scheme });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enrollment failed";
    return res.status(400).json({ message });
  }
}

export async function payInstallmentHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const scheme = await payInstallment(req.user.userId, req.params.schemeId as string);
    return res.json({ scheme });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return res.status(400).json({ message });
  }
}

export async function redeemHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const result = await redeemScheme(req.user.userId, req.params.schemeId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Redemption failed";
    return res.status(400).json({ message });
  }
}

export async function listSchemesHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const schemes = await getUserSchemes(req.user.userId);
    return res.json({ schemes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schemes";
    return res.status(500).json({ message });
  }
}

export async function getSchemeHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const scheme = await getSchemeDetail(req.user.userId, req.params.schemeId as string);
    return res.json({ scheme });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheme not found";
    return res.status(404).json({ message });
  }
}
