/**
 * Gold-API.com provider
 *
 * Free tier: unlimited real-time price requests (no key needed).
 * Historical: 10 req/hour (requires free API key from gold-api.com/dashboard).
 *
 * Base URL: https://api.gold-api.com
 * Docs: https://gold-api.com/docs
 *
 * Live response example:
 * { "name":"Gold", "price":5076.10, "symbol":"XAU",
 *   "updatedAt":"2026-02-12T05:14:43Z", "updatedAtReadable":"a few seconds ago" }
 */

import { env } from "../config/env.js";
import { Currency, HistoricalPoint, LiveQuote, Metal } from "../types/asset.js";

const API_BASE = "https://api.gold-api.com";

function metalToSymbol(metal: Metal): string {
  return metal === "gold" ? "XAU" : "XAG";
}

/* ─── FX Rates via Frankfurter (free, no key, unlimited) ─── */

const fxCache: { rates: Record<string, number>; fetchedAt: number } = { rates: {}, fetchedAt: 0 };
const FX_CACHE_MS = 60 * 60 * 1000; // 1 hour

const fallbackFx: Record<Currency, number> = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67
};

async function getFxRate(currency: Currency): Promise<number> {
  if (currency === "USD") return 1;

  const now = Date.now();
  if (now - fxCache.fetchedAt < FX_CACHE_MS && fxCache.rates[currency]) {
    return fxCache.rates[currency];
  }

  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,EUR,GBP", {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = (await res.json()) as { rates: Record<string, number> };
      fxCache.rates = { ...data.rates, USD: 1, AED: fallbackFx.AED };
      fxCache.fetchedAt = now;
      if (fxCache.rates[currency]) return fxCache.rates[currency];
    }
  } catch {
    // fall through to hardcoded
  }

  return fallbackFx[currency];
}

/* ─── Previous close tracking for change calculation ─── */

const prevCloseCache = new Map<string, { price: number; fetchedAt: number }>();
const PREV_CLOSE_TTL = 6 * 60 * 60 * 1000; // 6 hours

/* ─── Live Quote ─── */

export async function getGoldApiLiveQuote(metal: Metal, currency: Currency): Promise<LiveQuote> {
  const symbol = metalToSymbol(metal);
  const res = await fetch(`${API_BASE}/price/${symbol}`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" }
  });

  if (!res.ok) {
    throw new Error(`Gold-API request failed (${res.status})`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  const priceUsd = typeof data.price === "number" ? data.price : null;
  if (priceUsd === null || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error("Unable to parse live price from Gold-API");
  }

  // Calculate change from previous close
  const cacheKeyPrev = `prev:${symbol}`;
  const prevEntry = prevCloseCache.get(cacheKeyPrev);
  const now = Date.now();
  let prevClose = priceUsd; // default: 0 change

  if (prevEntry && now - prevEntry.fetchedAt < PREV_CLOSE_TTL) {
    prevClose = prevEntry.price;
  } else {
    // Store current price as baseline for future change calculations
    prevCloseCache.set(cacheKeyPrev, { price: priceUsd, fetchedAt: now });
  }

  const changeUsd = priceUsd - prevClose;
  const changePct = prevClose > 0 ? (changeUsd / prevClose) * 100 : 0;

  const fxRate = await getFxRate(currency);
  const price = priceUsd * fxRate;
  const change = changeUsd * fxRate;

  const timestamp = typeof data.updatedAt === "string"
    ? new Date(data.updatedAt).toISOString()
    : new Date().toISOString();

  return {
    metal,
    currency,
    unit: "oz",
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePct.toFixed(4)),
    timestamp,
    source: "gold_api"
  };
}

/* ─── Historical Series ─── */

export async function getGoldApiHistoricalSeries(
  metal: Metal,
  currency: Currency,
  points: number
): Promise<HistoricalPoint[]> {
  const apiKey = env.GOLD_API_KEY;
  if (!apiKey) {
    throw new Error("GOLD_API_KEY not set — skipping Gold-API historical");
  }

  const symbol = metalToSymbol(metal);
  const res = await fetch(`${API_BASE}/history/${symbol}`, {
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey
    }
  });

  if (!res.ok) {
    throw new Error(`Gold-API history request failed (${res.status})`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const fxRate = await getFxRate(currency);

  const rawItems = Array.isArray(data.history) ? data.history :
                   Array.isArray(data.data) ? data.data :
                   Array.isArray(data) ? data : [];

  const rows: HistoricalPoint[] = [];
  for (const item of rawItems as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;

    const date = (entry.date ?? entry.timestamp ?? entry.time) as string | number | undefined;
    const price = (entry.price ?? entry.close ?? entry.value) as number | undefined;

    if (!date || typeof price !== "number" || !Number.isFinite(price)) continue;

    const timeStr = typeof date === "number"
      ? new Date(date * 1000).toISOString()
      : new Date(date).toISOString();

    rows.push({ time: timeStr, price: Number((price * fxRate).toFixed(2)) });
  }

  if (rows.length === 0) {
    throw new Error("Unable to parse historical prices from Gold-API");
  }

  const deduped = Array.from(new Map(rows.map((r) => [r.time, r])).values());
  deduped.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return deduped.slice(-points);
}
