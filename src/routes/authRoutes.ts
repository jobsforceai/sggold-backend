import { Router } from "express";
import {
  changePasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
  requestJewellerHandler,
  updateProfileHandler
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/register", registerHandler);
router.post("/login", loginHandler);
router.post("/logout", logoutHandler);
router.get("/me", requireAuth, meHandler);
router.patch("/profile", requireAuth, updateProfileHandler);
router.patch("/password", requireAuth, changePasswordHandler);
router.post("/jeweller-request", requireAuth, requestJewellerHandler);

export default router;
