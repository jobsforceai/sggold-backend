import { Router } from "express";
import { getWalletHandler, getTransactionsHandler } from "../controllers/walletController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, getWalletHandler);
router.get("/transactions", requireAuth, getTransactionsHandler);

export default router;
