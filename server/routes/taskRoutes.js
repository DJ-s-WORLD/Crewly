import { Router } from "express";
import { body, param } from "express-validator";
import {
  listTasks,
  createTask,
  toggleTask,
  deleteTask,
} from "../controllers/taskController.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(authMiddleware);

router.get("/", listTasks);

router.post(
  "/",
  body("title").trim().notEmpty().withMessage("Title required"),
  validate,
  createTask
);

router.put("/:id", param("id").isMongoId(), validate, toggleTask);

router.delete("/:id", param("id").isMongoId(), validate, deleteTask);

export default router;
