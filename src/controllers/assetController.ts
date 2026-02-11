import { Request, Response } from "express";
import {
  getGoldRateTable,
  getHistoricalAssetQuote,
  getLiveAssetQuote,
  getOverview,
  getSilverRateTable
} from "../services/assetService.js";
import { currencySchema, historicalQuerySchema, metalSchema } from "../utils/validators.js";

const rangeToPoints: Record<"1D" | "1W" | "1M" | "5M" | "1Y" | "5Y" | "10Y", number> = {
  "1D": 24,
  "1W": 7,
  "1M": 30,
  "5M": 150,
  "1Y": 365,
  "5Y": 1825,
  "10Y": 3650
};

export async function overviewHandler(req: Request, res: Response) {
  const currency = currencySchema.parse(req.query.currency);
  const data = await getOverview(currency);
  res.json(data);
}

export async function liveHandler(req: Request, res: Response) {
  const metal = metalSchema.parse(req.params.metal);
  const currency = currencySchema.parse(req.query.currency);
  const data = await getLiveAssetQuote(metal, currency);
  res.json(data);
}

export async function historicalHandler(req: Request, res: Response) {
  const metal = metalSchema.parse(req.params.metal);
  const query = historicalQuerySchema.parse(req.query);
  const range = query.range ?? "1D";
  const points = query.points ?? rangeToPoints[range];
  const data = await getHistoricalAssetQuote(metal, query.currency ?? "INR", points);
  res.json({
    metal,
    currency: query.currency ?? "INR",
    range,
    points: data.data.length,
    source: data.source,
    data: data.data
  });
}

export async function goldRateTableHandler(req: Request, res: Response) {
  const currency = currencySchema.parse(req.query.currency);
  const table = await getGoldRateTable(currency);
  res.json({ currency, ...table });
}

export async function silverRateTableHandler(req: Request, res: Response) {
  const currency = currencySchema.parse(req.query.currency);
  const table = await getSilverRateTable(currency);
  res.json({ currency, ...table });
}
