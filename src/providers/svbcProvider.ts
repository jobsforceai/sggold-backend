/**
 * SVBC (svbcgold.com) provider — polled every 5 minutes.
 *
 * API: GET https://livemetalprice.onrender.com/api/prices/svbc
 * Auth: x-api-key header
 *
 * Returns spot prices (Gold/Silver in USD/oz), INR/USD FX rate,
 * local city prices (INR/g), and MCX futures.
 *
 * Architecture:
 *   - Background poller writes to cache every 5 min
 *   - Provider reader reads from cache (never hits API directly)
 *   - If cache empty, throws → fallback to next provider in chain
 */

import { env } from "../config/env.js";
import { getCache, setCache } from "../lib/cache.js";
import { Currency, LiveQuote, Metal } from "../types/asset.js";

const SVBC_API_URL = "https://livemetalprice.onrender.com/api/prices/svbc";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const POLL_CACHE_TTL = 10 * 60;         // 10 minutes (2x poll interval)
const PREV_PRICE_TTL = 24 * 60 * 60;    // 24 hours

/* ─── SVBC response types ─── */

type SvbcSpotEntry = {
  id: string;
  name: string;
  price: string;
  bid?: string;
  ask?: string;
  low?: string;
};

type SvbcResponse = {
  success: boolean;
  timestamp: string;
  source: string;
  data: {
    spotPrices: SvbcSpotEntry[];
    localPrices: SvbcSpotEntry[];
    futurePrices: SvbcSpotEntry[];
  };
};

/* ─── FX rate fallback (same pattern as goldApiProvider) ─── */

const fallbackFx: Record<Currency, number> = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
};

const fxCache: { rates: Record<string, number>; fetchedAt: number } = {
  rates: {},
  fetchedAt: 0,
};
const FX_CACHE_MS = 60 * 60 * 1000; // 1 hour

async function getFxRate(currency: Currency): Promise<number> {
  if (currency === "USD") return 1;

  // Try SVBC's own INR rate first
  if (currency === "INR") {
    const svbcFx = await getCache<{ rate: number }>("svbc:poll:fx:INR");
    if (svbcFx && Number.isFinite(svbcFx.rate) && svbcFx.rate > 0) {
      return svbcFx.rate;
    }
  }

  // Frankfurter fallback
  const now = Date.now();
  if (now - fxCache.fetchedAt < FX_CACHE_MS && fxCache.rates[currency]) {
    return fxCache.rates[currency];
  }

  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,EUR,GBP",
      { signal: AbortSignal.timeout(5000) }
    );
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

/* ─── Helpers ─── */

function findSpotPrice(spots: SvbcSpotEntry[], substring: string): number | null {
  const entry = spots.find((s) => s.name.toUpperCase().includes(substring));
  if (!entry) return null;
  const price = parseFloat(entry.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/* ─── Background Poller ─── */

async function pollSvbc(): Promise<void> {
  const apiKey = env.SVBC_API_KEY;
  if (!apiKey) return;

  const res = await fetch(SVBC_API_URL, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`SVBC API returned ${res.status}`);
  }

  const body = (await res.json()) as SvbcResponse;
  if (!body.success || !body.data?.spotPrices) {
    throw new Error("SVBC API returned success=false or missing data");
  }

  const { spotPrices } = body.data;
  const timestamp = body.timestamp || new Date().toISOString();

  // Parse spot prices
  const goldUsd = findSpotPrice(spotPrices, "GOLD");
  const silverUsd = findSpotPrice(spotPrices, "SILVER");
  const inrRate = findSpotPrice(spotPrices, "INR");

  // Store FX rate
  if (inrRate) {
    await setCache("svbc:poll:fx:INR", { rate: inrRate, timestamp }, POLL_CACHE_TTL);
  }

  // Build and cache quotes for each metal
  for (const [metal, priceUsd] of [["gold", goldUsd], ["silver", silverUsd]] as const) {
    if (priceUsd === null) {
      console.warn(`[svbc-poller] could not parse ${metal} price, skipping`);
      continue;
    }

    // Calculate change from previous poll
    const prevKey = `svbc:poll:prev:${metal}`;
    const prev = await getCache<{ price: number }>(prevKey);
    const prevPrice = prev?.price ?? priceUsd; // first poll: 0 change
    const change = priceUsd - prevPrice;
    const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

    const quote: LiveQuote = {
      metal,
      currency: "USD",
      unit: "oz",
      price: Number(priceUsd.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(4)),
      timestamp,
      source: "svbc",
    };

    await setCache(`svbc:poll:${metal}:USD`, quote, POLL_CACHE_TTL);
    await setCache(prevKey, { price: priceUsd }, PREV_PRICE_TTL);
  }

  const goldStr = goldUsd?.toFixed(2) ?? "N/A";
  const silverStr = silverUsd?.toFixed(2) ?? "N/A";
  const fxStr = inrRate?.toFixed(3) ?? "N/A";
  console.log(`[svbc-poller] updated gold=$${goldStr} silver=$${silverStr} fx=${fxStr}`);
}

export function startSvbcPoller(): void {
  console.log("[svbc-poller] starting (interval: 5 min)");

  // Immediate first fetch (non-blocking)
  pollSvbc().catch((err) => {
    console.error("[svbc-poller] initial fetch failed:", (err as Error).message);
  });

  // Recurring poll
  setInterval(() => {
    pollSvbc().catch((err) => {
      console.error("[svbc-poller] poll failed:", (err as Error).message);
    });
  }, POLL_INTERVAL_MS);
}

/* ─── Provider Reader (called by assetService) ─── */

export async function getSvbcLiveQuote(metal: Metal, currency: Currency): Promise<LiveQuote> {
  const cached = await getCache<LiveQuote>(`svbc:poll:${metal}:USD`);
  if (!cached) {
    throw new Error("SVBC poll cache empty — no data available");
  }

  // USD — return as-is
  if (currency === "USD") return cached;

  // Convert to target currency
  const fxRate = await getFxRate(currency);

  return {
    ...cached,
    currency,
    price: Number((cached.price * fxRate).toFixed(2)),
    change: Number((cached.change * fxRate).toFixed(2)),
  };
}
