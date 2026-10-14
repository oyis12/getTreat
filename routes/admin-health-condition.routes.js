import express from "express";
import {
  createHealthCondition,
  listHealthConditions,
  updateHealthCondition,
} from "../controllers/admin-health-condition.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/role.middleware.js";
import { requireAdminPermission } from "../middlewares/admin-permission.middleware.js";
import {
  validateCreateHealthCondition,
  validateUpdateHealthCondition,
} from "../validators/health-condition.validator.js";

const router = express.Router();

router.use(protect, adminOnly, requireAdminPermission("manage_assessments"));
router.get("/", listHealthConditions);
router.post("/", validateCreateHealthCondition, createHealthCondition);
router.patch("/:id", validateUpdateHealthCondition, updateHealthCondition);

export default router;
