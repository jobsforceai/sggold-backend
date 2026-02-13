import { Router } from "express";
import {
  getWalletHandler,
  getTransactionsHandler,
  storageBenefitStatusHandler,
  claimStorageBenefitHandler
} from "../controllers/walletController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, getWalletHandler);
router.get("/transactions", requireAuth, getTransactionsHandler);
router.get("/storage-benefit", requireAuth, storageBenefitStatusHandler);
router.post("/storage-benefit/claim", requireAuth, claimStorageBenefitHandler);

export default router;
