import { Router } from "express";
import { createDeliveryHandler, getStoresHandler, listDeliveryHandler } from "../controllers/deliveryController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/", requireAuth, createDeliveryHandler);
router.get("/", requireAuth, listDeliveryHandler);
router.get("/stores", getStoresHandler);

export default router;
