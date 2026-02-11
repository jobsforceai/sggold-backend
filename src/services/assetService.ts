import { env } from "../config/env.js";
import { getCache, setCache } from "../lib/cache.js";
import { getAlphaHistoricalSeries, getAlphaLiveQuote } from "../providers/alphaVantageProvider.js";
import { getHistoricalSeries, getLiveQuote } from "../providers/mockProvider.js";
import { Currency, HistoricalPoint, LiveQuote, Metal, ProviderSource, RateTableRow } from "../types/asset.js";

const gramsPerOunce = 31.1035;

type HistoricalResult = {
  data: HistoricalPoint[];
  source: ProviderSource;
};

const liveInFlight = new Map<string, Promise<LiveQuote>>();
const historicalInFlight = new Map<string, Promise<HistoricalResult>>();

const goldPurity = [
  { label: "Gold 24K", purity: 1 },
  { label: "Gold 22K", purity: 22 / 24 },
  { label: "Gold 20K", purity: 20 / 24 },
  { label: "Gold 18K", purity: 18 / 24 },
  { label: "Gold 14K", purity: 14 / 24 },
  { label: "Gold 10K", purity: 10 / 24 }
];

const silverPurity = [
  { label: "Silver 999", purity: 1 },
  { label: "Silver 925", purity: 0.925 },
  { label: "Silver 900", purity: 0.9 }
];

function cacheKey(...segments: string[]): string {
  return `asset:${segments.join(":")}`;
}

function isAlphaMode(): boolean {
  return env.DATA_PROVIDER_MODE === "alpha_vantage" && !!env.ALPHA_VANTAGE_API_KEY;
}

async function resolveLiveQuote(metal: Metal, currency: Currency): Promise<LiveQuote> {
  const shouldUseAlpha = isAlphaMode();

  if (shouldUseAlpha) {
    try {
      return await getAlphaLiveQuote(metal, currency);
    } catch (error) {
      console.warn("[provider] alpha live fallback to mock:", (error as Error).message);
    }
  }

  return getLiveQuote(metal, currency);
}

async function resolveHistoricalSeries(
  metal: Metal,
  currency: Currency,
  points: number
): Promise<HistoricalResult> {
  const shouldUseAlpha = isAlphaMode();

  if (shouldUseAlpha) {
    try {
      const data = await getAlphaHistoricalSeries(metal, currency, points);
      return { data, source: "alpha_vantage" };
    } catch (error) {
      console.warn("[provider] alpha history fallback to mock:", (error as Error).message);
    }
  }

  return { data: getHistoricalSeries(metal, currency, points), source: "mock" };
}

export async function getLiveAssetQuote(metal: Metal, currency: Currency): Promise<LiveQuote> {
  const key = cacheKey("live", metal, currency);
  const stickyAlphaKey = cacheKey("live-last-alpha", metal, currency);
  const cached = await getCache<LiveQuote>(key);
  if (cached) return cached;

  const inFlightKey = `${metal}:${currency}`;
  const existing = liveInFlight.get(inFlightKey);
  if (existing) return existing;

  const task = (async () => {
    const quote = await resolveLiveQuote(metal, currency);
    if (quote.source === "alpha_vantage") {
      await setCache(stickyAlphaKey, quote, 7 * 24 * 60 * 60);
    }
    if (quote.source === "mock" && isAlphaMode()) {
      const stickyAlpha = await getCache<LiveQuote>(stickyAlphaKey);
      if (stickyAlpha) {
        await setCache(key, stickyAlpha, Math.max(env.LIVE_CACHE_TTL_SECONDS, env.CACHE_TTL_SECONDS));
        return stickyAlpha;
      }
    }
    await setCache(key, quote, Math.max(env.LIVE_CACHE_TTL_SECONDS, env.CACHE_TTL_SECONDS));
    return quote;
  })();

  liveInFlight.set(inFlightKey, task);
  try {
    return await task;
  } finally {
    liveInFlight.delete(inFlightKey);
  }
}

export async function getHistoricalAssetQuote(
  metal: Metal,
  currency: Currency,
  points: number
): Promise<HistoricalResult> {
  const key = cacheKey("history", metal, currency, String(points));
  const stickyAlphaKey = cacheKey("history-last-alpha", metal, currency, String(points));
  const cached = await getCache<HistoricalResult>(key);
  if (cached) return cached;

  const inFlightKey = `${metal}:${currency}:${points}`;
  const existing = historicalInFlight.get(inFlightKey);
  if (existing) return existing;

  const task = (async () => {
    const history = await resolveHistoricalSeries(metal, currency, points);
    if (history.source === "alpha_vantage") {
      await setCache(stickyAlphaKey, history, 30 * 24 * 60 * 60);
    }
    if (history.source === "mock" && isAlphaMode()) {
      const stickyAlpha = await getCache<HistoricalResult>(stickyAlphaKey);
      if (stickyAlpha) {
        await setCache(
          key,
          stickyAlpha,
          Math.max(env.HISTORICAL_CACHE_TTL_SECONDS, env.CACHE_TTL_SECONDS)
        );
        return stickyAlpha;
      }
    }
    await setCache(key, history, Math.max(env.HISTORICAL_CACHE_TTL_SECONDS, env.CACHE_TTL_SECONDS));
    return history;
  })();

  historicalInFlight.set(inFlightKey, task);
  try {
    return await task;
  } finally {
    historicalInFlight.delete(inFlightKey);
  }
}

function buildRateRows(
  perGramBase: number,
  rows: Array<{ label: string; purity: number }>
): RateTableRow[] {
  return rows.map((row) => {
    const grams1 = perGramBase * row.purity;
    return {
      label: row.label,
      grams1: Number(grams1.toFixed(2)),
      grams10: Number((grams1 * 10).toFixed(2)),
      grams100: Number((grams1 * 100).toFixed(2)),
      kilogram1: Number((grams1 * 1000).toFixed(2)),
      ounce1: Number((grams1 * gramsPerOunce).toFixed(2))
    };
  });
}

export async function getGoldRateTable(currency: Currency) {
  const live = await getLiveAssetQuote("gold", currency);
  const perGram24k = live.price / gramsPerOunce;

  return {
    source: live.source,
    updatedAt: new Date().toISOString(),
    rows: buildRateRows(perGram24k, goldPurity)
  };
}

export async function getSilverRateTable(currency: Currency) {
  const live = await getLiveAssetQuote("silver", currency);
  const perGramPure = live.price / gramsPerOunce;

  return {
    source: live.source,
    updatedAt: new Date().toISOString(),
    rows: buildRateRows(perGramPure, silverPurity)
  };
}

export async function getOverview(currency: Currency) {
  const [gold, silver] = await Promise.all([
    getLiveAssetQuote("gold", currency),
    getLiveAssetQuote("silver", currency)
  ]);

  return {
    currency,
    updatedAt: new Date().toISOString(),
    source: gold.source === "alpha_vantage" && silver.source === "alpha_vantage" ? "alpha_vantage" : "mock",
    assets: { gold, silver }
  };
}
