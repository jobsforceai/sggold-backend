export type Metal = "gold" | "silver";
export type Currency = "USD" | "INR" | "EUR" | "GBP" | "AED";
export type ProviderSource = "gold_api" | "yahoo_finance" | "alpha_vantage" | "mock";

export type LiveQuote = {
  metal: Metal;
  currency: Currency;
  unit: "oz";
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
  source: ProviderSource;
};

export type HistoricalPoint = {
  time: string;
  price: number;
};

export type RateTableRow = {
  label: string;
  grams1: number;
  grams10: number;
  grams100: number;
  kilogram1: number;
  ounce1: number;
};
