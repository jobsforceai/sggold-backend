import { env } from "../config/env.js";
import { Currency, HistoricalPoint, LiveQuote, Metal } from "../types/asset.js";

const API_BASE = "https://www.alphavantage.co/query";
const fallbackFxRates: Record<Currency, number> = {
  USD: 1,
  INR: 83.2,
  EUR: 0.93,
  GBP: 0.79,
  AED: 3.67
};

function metalToSymbol(metal: Metal): "GOLD" | "SILVER" {
  return metal === "gold" ? "GOLD" : "SILVER";
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getFirstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = parseNumber(record[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function getFirstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim().length > 0) return raw;
  }
  return null;
}

async function fetchAlphaVantage(params: Record<string, string>): Promise<Record<string, unknown>> {
  if (!env.ALPHA_VANTAGE_API_KEY) {
    throw new Error("ALPHA_VANTAGE_API_KEY is missing");
  }

  const search = new URLSearchParams({ ...params, apikey: env.ALPHA_VANTAGE_API_KEY });
  const response = await fetch(`${API_BASE}?${search.toString()}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed (${response.status})`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const note = getFirstString(payload, ["Note", "Information", "Error Message"]);
  if (note) {
    throw new Error(note);
  }

  return payload;
}

async function getUsdFxRate(targetCurrency: Currency): Promise<number> {
  if (targetCurrency === "USD") return 1;

  try {
    const payload = await fetchAlphaVantage({
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: "USD",
      to_currency: targetCurrency
    });

    const block = asRecord(payload["Realtime Currency Exchange Rate"]);
    const rate = parseNumber(block["5. Exchange Rate"]);
    if (rate !== null) return rate;
  } catch {
    // fall through to static fallback
  }

  return fallbackFxRates[targetCurrency];
}

export async function getAlphaLiveQuote(metal: Metal, currency: Currency): Promise<LiveQuote> {
  const payload = await fetchAlphaVantage({
    function: "GOLD_SILVER_SPOT",
    symbol: metalToSymbol(metal)
  });

  const root = asRecord(payload);
  const dataArray = Array.isArray(root.data) ? (root.data as unknown[]) : [];
  const primary = dataArray.length > 0 ? asRecord(dataArray[0]) : root;

  const priceUsd =
    getFirstNumber(primary, ["price", "Price", "value", "Value", "close", "Close"]) ??
    getFirstNumber(root, ["price", "Price", "value", "Value", "close", "Close"]);

  if (priceUsd === null) {
    throw new Error("Unable to parse live spot price from Alpha Vantage response");
  }

  const fxRate = await getUsdFxRate(currency);
  const price = priceUsd * fxRate;
  const timestamp =
    getFirstString(primary, ["timestamp", "Timestamp", "date", "Date", "last_refreshed"]) ??
    getFirstString(root, ["timestamp", "Timestamp", "date", "Date", "last_refreshed"]) ??
    new Date().toISOString();

  return {
    metal,
    currency,
    unit: "oz",
    price: Number(price.toFixed(2)),
    change: 0,
    changePercent: 0,
    timestamp: new Date(timestamp).toISOString(),
    source: "alpha_vantage"
  };
}

export async function getAlphaHistoricalSeries(
  metal: Metal,
  currency: Currency,
  points: number
): Promise<HistoricalPoint[]> {
  const payload = await fetchAlphaVantage({
    function: "GOLD_SILVER_HISTORY",
    symbol: metalToSymbol(metal),
    interval: "daily"
  });

  const root = asRecord(payload);
  const fxRate = await getUsdFxRate(currency);

  const rows: HistoricalPoint[] = [];

  if (Array.isArray(root.data)) {
    for (const item of root.data as unknown[]) {
      const entry = asRecord(item);
      const date =
        getFirstString(entry, ["date", "timestamp", "time", "Date", "Timestamp"]) ?? "";
      const usdPrice = getFirstNumber(entry, ["price", "value", "close", "Price", "Value", "Close"]);
      if (!date || usdPrice === null) continue;
      rows.push({ time: new Date(date).toISOString(), price: Number((usdPrice * fxRate).toFixed(2)) });
    }
  }

  const timeSeries = asRecord(root["Time Series (Daily)"]);
  for (const [date, value] of Object.entries(timeSeries)) {
    const entry = asRecord(value);
    const usdPrice =
      getFirstNumber(entry, ["4. close", "3. low", "2. high", "1. open"]) ??
      getFirstNumber(entry, ["close", "price", "value"]);
    if (usdPrice === null) continue;
    rows.push({ time: new Date(date).toISOString(), price: Number((usdPrice * fxRate).toFixed(2)) });
  }

  if (rows.length === 0) {
    throw new Error("Unable to parse historical prices from Alpha Vantage response");
  }

  const deduped = Array.from(new Map(rows.map((row) => [row.time, row])).values());
  deduped.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return deduped.slice(-points);
}
