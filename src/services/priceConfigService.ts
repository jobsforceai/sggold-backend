import { businessConfig } from "../config/business.js";
import { PriceConfig, type IPriceConfig } from "../models/PriceConfig.js";

const CACHE_TTL_MS = 30_000; // 30 seconds

let cached: IPriceConfig | null = null;
let cachedAt = 0;

const defaultStates = [
  { stateCode: "AP", stateName: "Andhra Pradesh", markupPercent: 0 },
  { stateCode: "TS", stateName: "Telangana", markupPercent: 0 },
  { stateCode: "KA", stateName: "Karnataka", markupPercent: 0 },
  { stateCode: "TN", stateName: "Tamil Nadu", markupPercent: 0 },
  { stateCode: "KL", stateName: "Kerala", markupPercent: 0 },
  { stateCode: "MH", stateName: "Maharashtra", markupPercent: 0 },
  { stateCode: "DL", stateName: "Delhi", markupPercent: 0 },
  { stateCode: "GJ", stateName: "Gujarat", markupPercent: 0 },
  { stateCode: "RJ", stateName: "Rajasthan", markupPercent: 0 },
  { stateCode: "WB", stateName: "West Bengal", markupPercent: 0 },
  { stateCode: "UP", stateName: "Uttar Pradesh", markupPercent: 0 },
  { stateCode: "MP", stateName: "Madhya Pradesh", markupPercent: 0 },
  { stateCode: "BR", stateName: "Bihar", markupPercent: 0 },
  { stateCode: "OD", stateName: "Odisha", markupPercent: 0 },
  { stateCode: "PB", stateName: "Punjab", markupPercent: 0 },
  { stateCode: "HR", stateName: "Haryana", markupPercent: 0 },
  { stateCode: "GA", stateName: "Goa", markupPercent: 0 },
];

export async function getPriceConfig(): Promise<IPriceConfig> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  let doc = await PriceConfig.findOne().lean<IPriceConfig>();
  if (!doc) {
    const im = businessConfig.indianMarket;
    doc = await PriceConfig.create({
      goldPricePerGramPaise: null,
      silverPricePerGramPaise: null,
      buyPremiumPercent: 0,
      sellDiscountPercent: 0,
      gstPercent: businessConfig.regular.gstPercent,
      importDutyPercent: im.importDutyPercent,
      aidcPercent: im.aidcPercent,
      localPremiumPercent: im.localPremiumPercent,
      stateMarkups: defaultStates,
    });
    doc = doc.toObject() as IPriceConfig;
  }

  cached = doc;
  cachedAt = Date.now();
  return doc;
}

export async function updatePriceConfig(
  updates: Partial<Omit<IPriceConfig, "_id" | "createdAt" | "updatedAt">>
): Promise<IPriceConfig> {
  const doc = await PriceConfig.findOneAndUpdate(
    {},
    { $set: updates },
    { upsert: true, new: true, runValidators: true }
  ).lean<IPriceConfig>();

  // Bust cache
  cached = doc;
  cachedAt = Date.now();
  return doc!;
}
