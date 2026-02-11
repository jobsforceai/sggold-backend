import { Router } from "express";
import {
  dashboardStatsHandler,
  getUserDetailHandler,
  listAllDeliveriesHandler,
  listAllSchemesHandler,
  listAllTransactionsHandler,
  listUsersHandler,
  updateDeliveryStatusHandler,
  updateJewellerStatusHandler,
} from "../controllers/adminController.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.get("/stats", requireAdmin, dashboardStatsHandler);
router.get("/users", requireAdmin, listUsersHandler);
router.get("/users/:userId", requireAdmin, getUserDetailHandler);
router.patch("/users/:userId/jeweller-status", requireAdmin, updateJewellerStatusHandler);
router.get("/transactions", requireAdmin, listAllTransactionsHandler);
router.get("/schemes", requireAdmin, listAllSchemesHandler);
router.get("/deliveries", requireAdmin, listAllDeliveriesHandler);
router.patch("/deliveries/:id/status", requireAdmin, updateDeliveryStatusHandler);

export default router;
