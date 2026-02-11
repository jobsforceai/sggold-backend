import type { Request, Response } from "express";
import { User } from "../models/User.js";
import { Wallet } from "../models/Wallet.js";
import { Transaction } from "../models/Transaction.js";
import { Scheme } from "../models/Scheme.js";
import { DeliveryRequest } from "../models/DeliveryRequest.js";

export async function listUsersHandler(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const search = (req.query.search as string)?.trim();

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { phone: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return res.json({ users, total, page, limit });
}

export async function getUserDetailHandler(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const user = await User.findById(userId).select("-passwordHash").lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  const [wallet, transactions, schemes] = await Promise.all([
    Wallet.findOne({ userId }).lean(),
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    Scheme.find({ userId }).sort({ createdAt: -1 }).lean(),
  ]);

  return res.json({ user, wallet, transactions, schemes });
}

export async function updateJewellerStatusHandler(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const { status, slabPaise } = req.body as { status?: string; slabPaise?: number };

  if (!status || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
  }

  const update: Record<string, unknown> = { jewellerStatus: status };
  if (status === "approved" && slabPaise) {
    update.jewellerSubscriptionSlabPaise = slabPaise;
  }

  const user = await User.findByIdAndUpdate(userId, update, { new: true }).select("-passwordHash").lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  return res.json({ user });
}

export async function listAllTransactionsHandler(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

  const [transactions, total] = await Promise.all([
    Transaction.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments(),
  ]);

  return res.json({ transactions, total, page, limit });
}

export async function listAllSchemesHandler(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const [schemes, total] = await Promise.all([
    Scheme.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Scheme.countDocuments(),
  ]);

  return res.json({ schemes, total, page, limit });
}

export async function listAllDeliveriesHandler(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const [deliveries, total] = await Promise.all([
    DeliveryRequest.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    DeliveryRequest.countDocuments(),
  ]);

  return res.json({ deliveries, total, page, limit });
}

export async function updateDeliveryStatusHandler(req: Request, res: Response) {
  const { status } = req.body as { status?: string };
  const valid = ["pending", "processing", "ready", "collected", "cancelled"];
  if (!status || !valid.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${valid.join(", ")}` });
  }

  const delivery = await DeliveryRequest.findByIdAndUpdate(
    req.params.id as string,
    { status },
    { new: true }
  ).lean();

  if (!delivery) return res.status(404).json({ message: "Delivery not found" });
  return res.json({ delivery });
}

export async function dashboardStatsHandler(_req: Request, res: Response) {
  const [totalUsers, totalTransactions, activeSchemes, totalDeliveries, wallets] = await Promise.all([
    User.countDocuments(),
    Transaction.countDocuments(),
    Scheme.countDocuments({ status: "active" }),
    DeliveryRequest.countDocuments(),
    Wallet.aggregate([
      { $group: { _id: null, totalGoldMg: { $sum: "$balanceMg" }, totalPurchasedMg: { $sum: "$totalPurchasedMg" } } },
    ]),
  ]);

  const goldStats = wallets[0] ?? { totalGoldMg: 0, totalPurchasedMg: 0 };

  return res.json({
    totalUsers,
    totalTransactions,
    activeSchemes,
    totalDeliveries,
    totalGoldHeldMg: goldStats.totalGoldMg,
    totalGoldPurchasedMg: goldStats.totalPurchasedMg,
  });
}
