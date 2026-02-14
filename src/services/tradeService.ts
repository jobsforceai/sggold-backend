import { businessConfig } from "../config/business.js";
import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import { getLiveAssetQuote } from "./assetService.js";
import { getPriceConfig } from "./priceConfigService.js";
import { getWallet, getDailyPurchasedMg } from "./walletService.js";

const gramsPerOunce = 31.1035;

export async function getCurrentGoldPricePerGramPaise(): Promise<number> {
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

/**
 * Place a buy order (pending admin approval).
 * Locks in the current price but does NOT credit gold yet.
 */
export async function placeBuyOrder(userId: string, amountMg: number) {
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

  const priceCfg = await getPriceConfig();
  const basePricePerGramPaise = await getCurrentGoldPricePerGramPaise();

  // Apply buy premium from admin config
  const buyMultiplier = 1 + priceCfg.buyPremiumPercent / 100;
  const pricePerGramPaise = Math.round(basePricePerGramPaise * buyMultiplier);

  const totalPaise = Math.round((amountMg / 1000) * pricePerGramPaise);
  const gstPaise = Math.round(totalPaise * (priceCfg.gstPercent / 100));

  const wallet = await getWallet(userId);
  const bonusMg = calculateBonus(wallet.totalPurchasedMg, wallet.totalBonusMg, amountMg);

  const order = await Transaction.create({
    userId,
    type: "buy",
    amountMg,
    pricePerGramPaise,
    totalPaise: totalPaise + gstPaise,
    bonusMg,
    status: "pending",
    metadata: { gstPaise, basePaise: totalPaise, buyPremiumPercent: priceCfg.buyPremiumPercent },
  });

  return {
    order: order.toObject(),
    bonusMg,
    gstPaise,
    totalWithGst: totalPaise + gstPaise,
  };
}

/**
 * Place a sell order (pending admin approval).
 * Does NOT debit gold yet — admin must approve first.
 */
export async function placeSellOrder(userId: string, amountMg: number) {
  const cfg = businessConfig.regular;

  if (amountMg < cfg.minSellMg) {
    throw new Error(`Minimum sell is ${cfg.minSellMg / 1000}g`);
  }

  const wallet = await getWallet(userId);
  if (wallet.balanceMg < amountMg) {
    throw new Error(`Insufficient balance. You have ${wallet.balanceMg / 1000}g.`);
  }

  const priceCfg = await getPriceConfig();
  const basePricePerGramPaise = await getCurrentGoldPricePerGramPaise();

  // Apply sell discount from admin config
  const sellMultiplier = 1 - priceCfg.sellDiscountPercent / 100;
  const pricePerGramPaise = Math.round(basePricePerGramPaise * sellMultiplier);

  const totalPaise = Math.round((amountMg / 1000) * pricePerGramPaise);

  const order = await Transaction.create({
    userId,
    type: "sell",
    amountMg,
    pricePerGramPaise,
    totalPaise,
    status: "pending",
    metadata: { sellDiscountPercent: priceCfg.sellDiscountPercent },
  });

  return {
    order: order.toObject(),
    estimatedValue: totalPaise,
  };
}

/**
 * Admin approves a pending order — executes the wallet update.
 */
export async function approveOrder(orderId: string) {
  const order = await Transaction.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status !== "pending") throw new Error("Order is not pending");

  const userId = order.userId.toString();

  if (order.type === "buy") {
    // Credit gold to wallet
    const wallet = await getWallet(userId);
    const bonusMg = order.bonusMg || 0;

    order.status = "completed";
    await order.save();

    if (bonusMg > 0) {
      await Transaction.create({
        userId,
        type: "bonus",
        amountMg: bonusMg,
        pricePerGramPaise: order.pricePerGramPaise,
        totalPaise: 0,
        bonusMg: 0,
        status: "completed",
        metadata: { reason: "first_gram_bonus", parentTxId: order._id },
      });
    }

    await Wallet.updateOne(
      { userId },
      {
        $inc: {
          balanceMg: order.amountMg + bonusMg,
          totalPurchasedMg: order.amountMg,
          totalBonusMg: bonusMg,
        },
      }
    );

    return {
      order: order.toObject(),
      newBalance: wallet.balanceMg + order.amountMg + bonusMg,
    };
  }

  if (order.type === "sell") {
    // Verify balance still sufficient
    const wallet = await getWallet(userId);
    if (wallet.balanceMg < order.amountMg) {
      throw new Error(`User balance insufficient. Has ${wallet.balanceMg / 1000}g, needs ${order.amountMg / 1000}g.`);
    }

    order.status = "completed";
    await order.save();

    await Wallet.updateOne(
      { userId },
      { $inc: { balanceMg: -order.amountMg } }
    );

    return {
      order: order.toObject(),
      newBalance: wallet.balanceMg - order.amountMg,
    };
  }

  throw new Error(`Cannot approve order of type "${order.type}"`);
}

/**
 * Admin rejects a pending order — no wallet changes.
 */
export async function rejectOrder(orderId: string) {
  const order = await Transaction.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status !== "pending") throw new Error("Order is not pending");

  order.status = "cancelled";
  await order.save();

  return { order: order.toObject() };
}

/**
 * Get pending orders for admin view.
 */
export async function getPendingOrders(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Transaction.find({ status: "pending", type: { $in: ["buy", "sell"] } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name phone")
      .lean(),
    Transaction.countDocuments({ status: "pending", type: { $in: ["buy", "sell"] } }),
  ]);

  return { orders, total, page, limit };
}
