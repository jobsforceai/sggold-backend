import type { Request, Response } from "express";
import { executeBuy, executeSell } from "../services/tradeService.js";
import { buySchema, sellSchema } from "../utils/tradeValidators.js";

export async function buyHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const { amountMg } = buySchema.parse(req.body);
    const result = await executeBuy(req.user.userId, amountMg);
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
    const result = await executeSell(req.user.userId, amountMg);
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sell failed";
    return res.status(400).json({ message });
  }
}
