import { businessConfig } from "../config/business.js";
import { Scheme, type IScheme } from "../models/Scheme.js";
import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import { getLiveAssetQuote } from "./assetService.js";

const gramsPerOunce = 31.1035;
const cfg = businessConfig.scheme;

function findSlab(slabAmountPaise: number) {
  return cfg.slabs.find((s) => s.monthlyPaise === slabAmountPaise);
}

export async function enrollScheme(
  userId: string,
  slabAmountPaise: number,
  sgxCode?: string
): Promise<IScheme> {
  const slab = findSlab(slabAmountPaise);
  if (!slab) {
    throw new Error("Invalid scheme slab amount");
  }

  const existingActive = await Scheme.findOne({ userId, status: "active" });
  if (existingActive) {
    throw new Error("You already have an active scheme. Complete or withdraw it first.");
  }

  const now = new Date();
  const installments = Array.from({ length: cfg.durationMonths }, (_, i) => ({
    dueDate: new Date(now.getTime() + i * cfg.cycleDays * 24 * 60 * 60 * 1000),
    amountPaise: slab.monthlyPaise,
    status: i === 0 ? ("paid" as const) : ("pending" as const),
    ...(i === 0 ? { paidDate: now } : {}),
  }));

  const scheme = await Scheme.create({
    userId,
    slabAmountPaise: slab.monthlyPaise,
    bonusAmountPaise: slab.bonusPaise,
    status: "active",
    startDate: now,
    installments,
    missedCount: 0,
    ...(sgxCode ? { sgxCode, sgxVerified: true, sgxReward: "250mg_gold_coin" } : {}),
  });

  await Transaction.create({
    userId,
    type: "scheme_credit",
    amountMg: 0,
    pricePerGramPaise: 0,
    totalPaise: slab.monthlyPaise,
    status: "completed",
    metadata: { schemeId: scheme._id, installmentIndex: 0, action: "enrollment" },
  });

  return scheme;
}

export async function payInstallment(userId: string, schemeId: string): Promise<IScheme> {
  const scheme = await Scheme.findOne({ _id: schemeId, userId });
  if (!scheme) throw new Error("Scheme not found");
  if (scheme.status !== "active") throw new Error("Scheme is not active");

  const nextIndex = scheme.installments.findIndex((inst) => inst.status === "pending");
  if (nextIndex === -1) {
    throw new Error("All installments are already paid");
  }

  scheme.installments[nextIndex].status = "paid";
  scheme.installments[nextIndex].paidDate = new Date();

  const allPaid = scheme.installments.every((inst) => inst.status === "paid" || inst.status === "advance");
  if (allPaid) {
    scheme.status = "completed";
  }

  await scheme.save();

  await Transaction.create({
    userId,
    type: "scheme_credit",
    amountMg: 0,
    pricePerGramPaise: 0,
    totalPaise: scheme.slabAmountPaise,
    status: "completed",
    metadata: { schemeId: scheme._id, installmentIndex: nextIndex, action: "installment_payment" },
  });

  return scheme;
}

export async function redeemScheme(userId: string, schemeId: string) {
  const scheme = await Scheme.findOne({ _id: schemeId, userId });
  if (!scheme) throw new Error("Scheme not found");
  if (scheme.status !== "completed") throw new Error("Scheme is not completed yet. All 11 installments must be paid.");

  const paidCount = scheme.installments.filter((i) => i.status === "paid" || i.status === "advance").length;
  if (paidCount < cfg.durationMonths) {
    throw new Error("Not all installments are paid");
  }

  const totalPaidPaise = paidCount * scheme.slabAmountPaise;
  const totalWithBonusPaise = totalPaidPaise + scheme.bonusAmountPaise;

  const quote = await getLiveAssetQuote("gold", "INR");
  const pricePerGramPaise = Math.round((quote.price / gramsPerOunce) * 100);
  const totalGoldMg = Math.round((totalWithBonusPaise / pricePerGramPaise) * 1000);

  await Transaction.create({
    userId,
    type: "scheme_credit",
    amountMg: totalGoldMg,
    pricePerGramPaise,
    totalPaise: totalWithBonusPaise,
    status: "completed",
    metadata: {
      schemeId: scheme._id,
      action: "redemption",
      totalPaidPaise,
      bonusPaise: scheme.bonusAmountPaise,
    },
  });

  // SGX Loyalty Reward: extra 250mg gold coin if verified
  const sgxBonusMg = scheme.sgxVerified ? 250 : 0;

  if (sgxBonusMg > 0) {
    await Transaction.create({
      userId,
      type: "bonus",
      amountMg: sgxBonusMg,
      pricePerGramPaise,
      totalPaise: 0,
      status: "completed",
      metadata: {
        schemeId: scheme._id,
        action: "sgx_loyalty_reward",
        sgxCode: scheme.sgxCode,
        reward: scheme.sgxReward,
      },
    });
  }

  await Wallet.updateOne(
    { userId },
    { $inc: { balanceMg: totalGoldMg + sgxBonusMg } }
  );

  return {
    totalPaidPaise,
    bonusPaise: scheme.bonusAmountPaise,
    totalValuePaise: totalWithBonusPaise,
    goldCreditedMg: totalGoldMg,
    sgxBonusMg,
    pricePerGramPaise,
  };
}

export async function getUserSchemes(userId: string) {
  return Scheme.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function getSchemeDetail(userId: string, schemeId: string) {
  const scheme = await Scheme.findOne({ _id: schemeId, userId }).lean();
  if (!scheme) throw new Error("Scheme not found");
  return scheme;
}
