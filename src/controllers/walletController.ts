import type { Request, Response } from "express";
import { getWallet, getTransactions, claimStorageBenefit, getStorageBenefitStatus } from "../services/walletService.js";

export async function getWalletHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const wallet = await getWallet(req.user.userId);
    return res.json({
      balanceMg: wallet.balanceMg,
      totalPurchasedMg: wallet.totalPurchasedMg,
      totalBonusMg: wallet.totalBonusMg,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get wallet";
    return res.status(500).json({ message });
  }
}

export async function getTransactionsHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  try {
    const result = await getTransactions(req.user.userId, page, limit);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get transactions";
    return res.status(500).json({ message });
  }
}

export async function storageBenefitStatusHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const status = await getStorageBenefitStatus(req.user.userId);
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ message: "Failed to check status" });
  }
}

export async function claimStorageBenefitHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const result = await claimStorageBenefit(req.user.userId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim failed";
    return res.status(400).json({ message });
  }
}
