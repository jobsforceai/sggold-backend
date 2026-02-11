import type { Request, Response } from "express";
import { z } from "zod";
import { createDeliveryRequest, getStores, getUserDeliveries } from "../services/deliveryService.js";

const createDeliverySchema = z.object({
  amountMg: z.number().int().min(1000, "Minimum delivery is 1g"),
  productType: z.enum(["coin", "bar"]),
  productWeightMg: z.number().int().positive(),
  pickupStoreId: z.string().min(1),
});

export async function createDeliveryHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const data = createDeliverySchema.parse(req.body);
    const delivery = await createDeliveryRequest(req.user.userId, data);
    return res.status(201).json({ delivery });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery request failed";
    return res.status(400).json({ message });
  }
}

export async function listDeliveryHandler(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });

  try {
    const deliveries = await getUserDeliveries(req.user.userId);
    return res.json({ deliveries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load deliveries";
    return res.status(500).json({ message });
  }
}

export async function getStoresHandler(_req: Request, res: Response) {
  const stores = await getStores();
  return res.json({ stores });
}
