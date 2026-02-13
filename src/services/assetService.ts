import { env } from "../config/env.js";
import { getCache, setCache } from "../lib/cache.js";
import { getAlphaHistoricalSeries, getAlphaLiveQuote } from "../providers/alphaVantageProvider.js";
import { getGoldApiLiveQuote } from "../providers/goldApiProvider.js";
import { getYahooHistoricalSeries } from "../providers/yahooFinanceProvider.js";
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

/**
 * Provider chain: Gold-API → Alpha Vantage → Mock
 * In "auto" mode, tries each in order.
 * In specific modes, tries just that provider then falls back to mock.
 */
async function resolveLiveQuote(metal: Metal, currency: Currency): Promise<LiveQuote> {
  const mode = env.DATA_PROVIDER_MODE;

  // Gold-API (free, unlimited real-time)
  if (mode === "auto" || mode === "gold_api") {
    try {
      return await getGoldApiLiveQuote(metal, currency);
    } catch (error) {
      console.warn("[provider] gold-api live failed:", (error as Error).message);
    }
  }

  // Alpha Vantage (rate-limited free tier)
  if ((mode === "auto" || mode === "alpha_vantage") && env.ALPHA_VANTAGE_API_KEY) {
    try {
      return await getAlphaLiveQuote(metal, currency);
    } catch (error) {
      console.warn("[provider] alpha live failed:", (error as Error).message);
    }
  }

  // Mock fallback
  return getLiveQuote(metal, currency);
}

async function resolveHistoricalSeries(
  metal: Metal,
  currency: Currency,
  points: number
): Promise<HistoricalResult> {
  // Yahoo Finance — free, no key, real market data (primary for historical)
  try {
    const data = await getYahooHistoricalSeries(metal, currency, points);
    return { data, source: "yahoo_finance" };
  } catch (error) {
    console.warn("[provider] yahoo history failed:", (error as Error).message);
  }

  // Alpha Vantage historical (fallback)
  if (env.ALPHA_VANTAGE_API_KEY) {
    try {
      const data = await getAlphaHistoricalSeries(metal, currency, points);
      return { data, source: "alpha_vantage" };
    } catch (error) {
      console.warn("[provider] alpha history failed:", (error as Error).message);
    }
  }

  return { data: getHistoricalSeries(metal, currency, points), source: "mock" };
}

export async function getLiveAssetQuote(metal: Metal, currency: Currency): Promise<LiveQuote> {
  const key = cacheKey("live", metal, currency);
  const stickyKey = cacheKey("live-last-real", metal, currency);
  const cached = await getCache<LiveQuote>(key);
  if (cached && cached.source !== "mock") return cached;

  const inFlightKey = `${metal}:${currency}`;
  const existing = liveInFlight.get(inFlightKey);
  if (existing) return existing;

  const task = (async () => {
    const quote = await resolveLiveQuote(metal, currency);

    // Cache real provider data as sticky fallback (7 days)
    if (quote.source !== "mock") {
      await setCache(stickyKey, quote, 7 * 24 * 60 * 60);
    }

    // If we got mock but have sticky real data, prefer that
    if (quote.source === "mock" && env.DATA_PROVIDER_MODE !== "mock") {
      const sticky = await getCache<LiveQuote>(stickyKey);
      if (sticky) {
        await setCache(key, sticky, Math.max(env.LIVE_CACHE_TTL_SECONDS, env.CACHE_TTL_SECONDS));
        return sticky;
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
  const stickyKey = cacheKey("history-last-real", metal, currency, String(points));
  const cached = await getCache<HistoricalResult>(key);
  // Serve cache only if it's real data — skip stale mock entries
  if (cached && cached.source !== "mock") return cached;

  const inFlightKey = `${metal}:${currency}:${points}`;
  const existing = historicalInFlight.get(inFlightKey);
  if (existing) return existing;

  const task = (async () => {
    const history = await resolveHistoricalSeries(metal, currency, points);

    if (history.source !== "mock") {
      await setCache(stickyKey, history, 30 * 24 * 60 * 60);
    }

    if (history.source === "mock" && env.DATA_PROVIDER_MODE !== "mock") {
      const sticky = await getCache<HistoricalResult>(stickyKey);
      if (sticky) {
        await setCache(key, sticky, Math.max(env.HISTORICAL_CACHE_TTL_SECONDS, env.CACHE_TTL_SECONDS));
        return sticky;
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

  const source = gold.source === "mock" && silver.source === "mock" ? "mock" : gold.source;

  return {
    currency,
    updatedAt: new Date().toISOString(),
    source,
    assets: { gold, silver }
  };
}
