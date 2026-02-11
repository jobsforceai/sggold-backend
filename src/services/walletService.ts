import { Wallet, type IWallet } from "../models/Wallet.js";
import { Transaction } from "../models/Transaction.js";

export async function getWallet(userId: string): Promise<IWallet> {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balanceMg: 0, totalPurchasedMg: 0, totalBonusMg: 0 });
  }
  return wallet;
}

export async function getDailyPurchasedMg(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await Transaction.aggregate([
    {
      $match: {
        userId: { $eq: userId },
        type: "buy",
        status: "completed",
        createdAt: { $gte: startOfDay },
      },
    },
    { $group: { _id: null, total: { $sum: "$amountMg" } } },
  ]);

  return result.length > 0 ? result[0].total : 0;
}

export async function getTransactions(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    Transaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments({ userId }),
  ]);

  return { transactions, total, page, limit };
}
