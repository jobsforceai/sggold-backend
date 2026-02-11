import { businessConfig } from "../config/business.js";
import { DeliveryRequest } from "../models/DeliveryRequest.js";
import { Wallet } from "../models/Wallet.js";
import { Transaction } from "../models/Transaction.js";
import { getLiveAssetQuote } from "./assetService.js";

const gramsPerOunce = 31.1035;
const cfg = businessConfig.delivery;

export async function createDeliveryRequest(userId: string, data: {
  amountMg: number;
  productType: "coin" | "bar";
  productWeightMg: number;
  pickupStoreId: string;
}) {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.balanceMg < data.amountMg) {
    throw new Error(`Insufficient balance. Need ${data.amountMg / 1000}g.`);
  }

  if (data.amountMg < 1000) {
    throw new Error("Minimum delivery is 1g (1000mg)");
  }

  const validWeights: readonly number[] = data.productType === "coin" ? cfg.coinWeightsMg : cfg.barWeightsMg;
  if (!validWeights.includes(data.productWeightMg)) {
    throw new Error("Invalid product weight");
  }

  const store = cfg.stores.find((s) => s.id === data.pickupStoreId);
  if (!store) {
    throw new Error("Invalid pickup store");
  }

  const quote = await getLiveAssetQuote("gold", "INR");
  const pricePerGramPaise = Math.round((quote.price / gramsPerOunce) * 100);
  const goldValuePaise = Math.round((data.amountMg / 1000) * pricePerGramPaise);

  const coinChargePaise = data.productType === "coin" ? cfg.coinChargePaise : 0;
  const gstPaise = Math.round((goldValuePaise * cfg.gstPercent) / 100);
  const totalChargePaise = coinChargePaise + gstPaise;

  await Wallet.updateOne({ userId }, { $inc: { balanceMg: -data.amountMg } });

  await Transaction.create({
    userId,
    type: "withdrawal",
    amountMg: data.amountMg,
    pricePerGramPaise,
    totalPaise: goldValuePaise,
    status: "completed",
    metadata: { reason: "physical_delivery", pickupStoreId: data.pickupStoreId },
  });

  const delivery = await DeliveryRequest.create({
    userId,
    amountMg: data.amountMg,
    productType: data.productType,
    productWeightMg: data.productWeightMg,
    coinChargePaise,
    gstPaise,
    totalChargePaise,
    pickupStoreId: data.pickupStoreId,
    status: "pending",
  });

  return delivery;
}

export async function getUserDeliveries(userId: string) {
  return DeliveryRequest.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function getStores() {
  return cfg.stores;
}
