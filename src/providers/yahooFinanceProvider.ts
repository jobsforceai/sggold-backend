/**
 * Yahoo Finance provider — historical price data
 *
 * Free, no API key required, real market data.
 * Uses gold futures (GC=F) and silver futures (SI=F).
 * Prices are in USD per troy ounce.
 */

import { Currency, HistoricalPoint, Metal } from "../types/asset.js";

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

function metalToTicker(metal: Metal): string {
  return metal === "gold" ? "GC=F" : "SI=F";
}

/**
 * Map our point counts to Yahoo Finance range + interval.
 * Point counts from controller: 1D=24, 1W=7, 1M=30, 5M=150, 1Y=365, 5Y=1825, 10Y=3650
 * Must use exact matches since 7 < 24 but needs a wider range.
 */
function rangeToYahoo(points: number): { range: string; interval: string } {
  if (points === 7) return { range: "5d", interval: "30m" };      // 1W
  if (points <= 24) return { range: "1d", interval: "5m" };       // 1D intraday
  if (points <= 30) return { range: "1mo", interval: "1d" };      // 1M
  if (points <= 150) return { range: "6mo", interval: "1d" };     // 5M
  if (points <= 365) return { range: "1y", interval: "1d" };      // 1Y
  if (points <= 1825) return { range: "5y", interval: "1wk" };    // 5Y
  return { range: "10y", interval: "1mo" };                        // 10Y
}

/* ─── FX (reuse Frankfurter, same as goldApiProvider) ─── */

const fxCache: { rates: Record<string, number>; fetchedAt: number } = { rates: {}, fetchedAt: 0 };
const FX_CACHE_MS = 60 * 60 * 1000;

const fallbackFx: Record<Currency, number> = {
  USD: 1, INR: 83.5, EUR: 0.92, GBP: 0.79, AED: 3.67
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
  } catch { /* fall through */ }

  return fallbackFx[currency];
}

/* ─── Historical Series ─── */

type YahooChart = {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
    error: unknown;
  };
};

export async function getYahooHistoricalSeries(
  metal: Metal,
  currency: Currency,
  points: number
): Promise<HistoricalPoint[]> {
  const ticker = metalToTicker(metal);
  const { range, interval } = rangeToYahoo(points);

  const url = `${CHART_BASE}/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SGGold/1.0)",
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance request failed (${res.status})`);
  }

  const data = (await res.json()) as YahooChart;

  if (data.chart.error) {
    throw new Error(`Yahoo Finance error: ${JSON.stringify(data.chart.error)}`);
  }

  const result = data.chart.result?.[0];
  if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
    throw new Error("Unable to parse Yahoo Finance response");
  }

  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;
  const fxRate = await getFxRate(currency);

  const rows: HistoricalPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const priceUsd = closes[i];
    if (priceUsd === null || priceUsd === undefined || !Number.isFinite(priceUsd)) continue;

    rows.push({
      time: new Date(timestamps[i] * 1000).toISOString(),
      price: Number((priceUsd * fxRate).toFixed(2))
    });
  }

  if (rows.length === 0) {
    throw new Error("No valid price data from Yahoo Finance");
  }

  return rows.slice(-points);
}
