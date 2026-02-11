import { Router } from "express";
import {
  enrollHandler,
  getSchemeHandler,
  listSchemesHandler,
  payInstallmentHandler,
  redeemHandler,
} from "../controllers/schemeController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/enroll", requireAuth, enrollHandler);
router.post("/:schemeId/pay", requireAuth, payInstallmentHandler);
router.post("/:schemeId/redeem", requireAuth, redeemHandler);
router.get("/", requireAuth, listSchemesHandler);
router.get("/:schemeId", requireAuth, getSchemeHandler);

export default router;
