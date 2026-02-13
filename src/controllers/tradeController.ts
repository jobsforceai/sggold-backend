import type { Request, Response } from "express";
import { placeBuyOrder, placeSellOrder, getCurrentGoldPricePerGramPaise } from "../services/tradeService.js";
import { verifySgxCode } from "../services/sagenexService.js";
import { buySchema, sellSchema } from "../utils/tradeValidators.js";

export async function buyHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const { amountMg } = buySchema.parse(req.body);
    const result = await placeBuyOrder(req.user.userId, amountMg);
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Buy failed";
    return res.status(400).json({ message });
  }
}

export async function sellHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const { amountMg } = sellSchema.parse(req.body);
    const result = await placeSellOrder(req.user.userId, amountMg);
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sell failed";
    return res.status(400).json({ message });
  }
}

export async function verifySgxHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  const { code, monthlyAmountPaise } = req.body as { code?: string; monthlyAmountPaise?: number };

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({ valid: false, error: "Code is required" });
  }

  if (!monthlyAmountPaise || monthlyAmountPaise < 1000000) {
    return res.status(400).json({ valid: false, error: "Minimum Rs 10,000/month scheme required" });
  }

  try {
    const result = await verifySgxCode({
      code: code.trim(),
      sggoldUserId: req.user.userId,
      monthlyAmountPaise,
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return res.json({ valid: false, code, error: message });
  }
}

export async function livePriceHandler(_req: Request, res: Response) {
  try {
    const pricePerGramPaise = await getCurrentGoldPricePerGramPaise();
    return res.json({ pricePerGramPaise, gstPercent: 3 });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch price" });
  }
}
