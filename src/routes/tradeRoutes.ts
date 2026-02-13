import { Router } from "express";
import { buyHandler, sellHandler, livePriceHandler, verifySgxHandler } from "../controllers/tradeController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/price", livePriceHandler);
router.post("/buy", requireAuth, buyHandler);
router.post("/sell", requireAuth, sellHandler);
router.post("/sgx/verify", requireAuth, verifySgxHandler);

export default router;
