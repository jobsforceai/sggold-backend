import { Router } from "express";
import {
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/register", registerHandler);
router.post("/login", loginHandler);
router.post("/logout", logoutHandler);
router.get("/me", requireAuth, meHandler);

export default router;
