import { businessConfig } from "../config/business.js";
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

export async function claimStorageBenefit(userId: string) {
  const cfg = businessConfig.storageBenefit;
  const wallet = await getWallet(userId);

  if (wallet.balanceMg < cfg.thresholdMg) {
    throw new Error(`You need at least ${cfg.thresholdMg / 1000}g to claim the storage benefit. You have ${wallet.balanceMg / 1000}g.`);
  }

  // Check if already claimed this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const alreadyClaimed = await Transaction.findOne({
    userId,
    type: "storage_reward",
    status: "completed",
    createdAt: { $gte: startOfMonth },
  });

  if (alreadyClaimed) {
    throw new Error("Storage benefit already claimed this month.");
  }

  await Transaction.create({
    userId,
    type: "storage_reward",
    amountMg: cfg.rewardMgPerMonth,
    pricePerGramPaise: 0,
    totalPaise: 0,
    status: "completed",
    metadata: { month: now.getMonth() + 1, year: now.getFullYear() },
  });

  await Wallet.updateOne(
    { userId },
    { $inc: { balanceMg: cfg.rewardMgPerMonth, totalBonusMg: cfg.rewardMgPerMonth } }
  );

  return {
    creditedMg: cfg.rewardMgPerMonth,
    newBalance: wallet.balanceMg + cfg.rewardMgPerMonth,
  };
}

export async function getStorageBenefitStatus(userId: string) {
  const cfg = businessConfig.storageBenefit;
  const wallet = await getWallet(userId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const claimedThisMonth = await Transaction.findOne({
    userId,
    type: "storage_reward",
    status: "completed",
    createdAt: { $gte: startOfMonth },
  });

  return {
    eligible: wallet.balanceMg >= cfg.thresholdMg,
    thresholdMg: cfg.thresholdMg,
    rewardMg: cfg.rewardMgPerMonth,
    balanceMg: wallet.balanceMg,
    claimedThisMonth: !!claimedThisMonth,
  };
}

export async function getTransactions(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    Transaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments({ userId }),
  ]);

  return { transactions, total, page, limit };
}
