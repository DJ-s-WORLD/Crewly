import { Router } from "express";
import { body } from "express-validator";
import { chat, history } from "../controllers/aiController.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(authMiddleware);

router.post(
  "/chat",
  body("message").trim().notEmpty().withMessage("Message required"),
  validate,
  chat
);
router.get("/history", history);

export default router;
