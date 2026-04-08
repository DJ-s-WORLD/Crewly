import { Router } from "express";
import { body } from "express-validator";
import { signup, login, me } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const signupRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }).withMessage("Password min 6 characters"),
];

const loginRules = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

router.post("/signup", signupRules, validate, signup);
router.post("/login", loginRules, validate, login);
router.get("/me", authMiddleware, me);

export default router;
