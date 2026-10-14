import express from "express";
import {
  addHealthCondition,
  updateHealthCondition,
  removeHealthCondition,
} from "../controllers/pregnancy-health-condition.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import {
  validateAddHealthCondition,
  validateUpdateHealthCondition,
} from "../validators/pregnancy-health-condition.validator.js";
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";

const router = express.Router();

router.post(
  "/me/pregnancy/health-conditions",
  protect,
  requireActivePlatformSubscription,
  validateAddHealthCondition,
  addHealthCondition
);

router.patch(
  "/me/pregnancy/health-conditions/:conditionId",
  protect,
  requireActivePlatformSubscription,
  validateUpdateHealthCondition,
  updateHealthCondition
);

router.delete(
  "/me/pregnancy/health-conditions/:conditionId",
  protect,
  requireActivePlatformSubscription,
  removeHealthCondition
);

export default router;
