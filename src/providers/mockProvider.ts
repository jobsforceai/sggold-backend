import { Currency, HistoricalPoint, LiveQuote, Metal } from "../types/asset.js";

const basePerOz: Record<Metal, number> = {
  gold: 2870,
  silver: 32
};

const fx: Record<Currency, number> = {
  USD: 1,
  INR: 83.2,
  EUR: 0.93,
  GBP: 0.79,
  AED: 3.67
};

function seededNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) - 0.5;
}

export function getLiveQuote(metal: Metal, currency: Currency): LiveQuote {
  const now = Date.now();
  const drift = seededNoise(now / 100000) * 0.6;
  const price = (basePerOz[metal] + drift) * fx[currency];
  const change = seededNoise(now / 300000) * 2;
  const changePercent = (change / price) * 100;

  return {
    metal,
    currency,
    unit: "oz",
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(4)),
    timestamp: new Date().toISOString(),
    source: "mock"
  };
}

export function getHistoricalSeries(metal: Metal, currency: Currency, points = 48): HistoricalPoint[] {
  const now = Date.now();
  const live = getLiveQuote(metal, currency).price;

  return Array.from({ length: points }, (_, index) => {
    const reverseIndex = points - index;
    const time = new Date(now - reverseIndex * 30 * 60 * 1000).toISOString();
    const wave = Math.sin(index / 4) * (metal === "gold" ? 7 : 0.2);
    const noise = seededNoise(index * 17.31) * (metal === "gold" ? 4 : 0.1);
    const price = live + wave + noise;

    return {
      time,
      price: Number(price.toFixed(2))
    };
  });
}
