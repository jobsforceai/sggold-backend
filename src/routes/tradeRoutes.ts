import { Router } from "express";
import { buyHandler, sellHandler } from "../controllers/tradeController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/buy", requireAuth, buyHandler);
router.post("/sell", requireAuth, sellHandler);

export default router;
