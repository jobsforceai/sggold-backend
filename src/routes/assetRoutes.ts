import { Router } from "express";
import {
  goldRateTableHandler,
  historicalHandler,
  liveHandler,
  overviewHandler,
  silverRateTableHandler
} from "../controllers/assetController.js";

const router = Router();

router.get("/overview", overviewHandler);
router.get("/gold/rates", goldRateTableHandler);
router.get("/silver/rates", silverRateTableHandler);
router.get("/:metal/live", liveHandler);
router.get("/:metal/historical", historicalHandler);

export default router;
