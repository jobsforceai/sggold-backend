import { businessConfig } from "../config/business.js";
import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import { getLiveAssetQuote } from "./assetService.js";
import { getWallet, getDailyPurchasedMg } from "./walletService.js";

const gramsPerOunce = 31.1035;

async function getCurrentGoldPricePerGramPaise(): Promise<number> {
  const quote = await getLiveAssetQuote("gold", "INR");
  const pricePerGram = quote.price / gramsPerOunce;
  return Math.round(pricePerGram * 100);
}

function calculateBonus(purchasedSoFarMg: number, bonusGivenMg: number, buyAmountMg: number): number {
  const cfg = businessConfig.firstGramBonus;

  if (purchasedSoFarMg >= cfg.thresholdMg) return 0;
  if (bonusGivenMg >= cfg.maxBonusMg) return 0;

  const rawBonus = Math.floor((buyAmountMg * cfg.bonusPercent) / 100);
  const remainingBonus = cfg.maxBonusMg - bonusGivenMg;
  return Math.min(rawBonus, remainingBonus);
}

export async function executeBuy(userId: string, amountMg: number) {
  const cfg = businessConfig.regular;

  if (amountMg < cfg.minBuyMg) {
    throw new Error(`Minimum buy is ${cfg.minBuyMg}mg`);
  }

  if (amountMg > cfg.maxBuyPerDayMg) {
    throw new Error(`Maximum buy per day is ${cfg.maxBuyPerDayMg / 1000}g`);
  }

  const dailyPurchased = await getDailyPurchasedMg(userId);
  if (dailyPurchased + amountMg > cfg.maxBuyPerDayMg) {
    throw new Error(`Daily limit exceeded. Already bought ${dailyPurchased / 1000}g today.`);
  }

  const pricePerGramPaise = await getCurrentGoldPricePerGramPaise();
  const totalPaise = Math.round((amountMg / 1000) * pricePerGramPaise);

  const wallet = await getWallet(userId);
  const bonusMg = calculateBonus(wallet.totalPurchasedMg, wallet.totalBonusMg, amountMg);

  const buyTx = await Transaction.create({
    userId,
    type: "buy",
    amountMg,
    pricePerGramPaise,
    totalPaise,
    bonusMg,
    status: "completed",
  });

  if (bonusMg > 0) {
    await Transaction.create({
      userId,
      type: "bonus",
      amountMg: bonusMg,
      pricePerGramPaise,
      totalPaise: 0,
      bonusMg: 0,
      status: "completed",
      metadata: { reason: "first_gram_bonus", parentTxId: buyTx._id },
    });
  }

  await Wallet.updateOne(
    { userId },
    {
      $inc: {
        balanceMg: amountMg + bonusMg,
        totalPurchasedMg: amountMg,
        totalBonusMg: bonusMg,
      },
    }
  );

  return {
    transaction: buyTx.toObject(),
    bonusMg,
    newBalance: wallet.balanceMg + amountMg + bonusMg,
  };
}

export async function executeSell(userId: string, amountMg: number) {
  const cfg = businessConfig.regular;

  if (amountMg < cfg.minSellMg) {
    throw new Error(`Minimum sell is ${cfg.minSellMg / 1000}g`);
  }

  const wallet = await getWallet(userId);
  if (wallet.balanceMg < amountMg) {
    throw new Error(`Insufficient balance. You have ${wallet.balanceMg / 1000}g.`);
  }

  const pricePerGramPaise = await getCurrentGoldPricePerGramPaise();
  const totalPaise = Math.round((amountMg / 1000) * pricePerGramPaise);

  const sellTx = await Transaction.create({
    userId,
    type: "sell",
    amountMg,
    pricePerGramPaise,
    totalPaise,
    status: "completed",
  });

  await Wallet.updateOne(
    { userId },
    { $inc: { balanceMg: -amountMg } }
  );

  return {
    transaction: sellTx.toObject(),
    newBalance: wallet.balanceMg - amountMg,
  };
}
