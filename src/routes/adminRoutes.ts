import { Router } from "express";
import {
  approveOrderHandler,
  dashboardStatsHandler,
  getUserDetailHandler,
  listAllDeliveriesHandler,
  listAllSchemesHandler,
  listAllTransactionsHandler,
  listPendingOrdersHandler,
  listUsersHandler,
  rejectOrderHandler,
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
router.get("/orders/pending", requireAdmin, listPendingOrdersHandler);
router.patch("/orders/:orderId/approve", requireAdmin, approveOrderHandler);
router.patch("/orders/:orderId/reject", requireAdmin, rejectOrderHandler);
router.get("/schemes", requireAdmin, listAllSchemesHandler);
router.get("/deliveries", requireAdmin, listAllDeliveriesHandler);
router.patch("/deliveries/:id/status", requireAdmin, updateDeliveryStatusHandler);

export default router;
