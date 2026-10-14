import express from "express";
import {
  getHealthAssessments,
  getHealthAssessment,
  saveHealthAssessment,
} from "../controllers/health-assessment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import validateHealthAssessmentPayload from "../validators/health-assessment.validator.js";
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";

const router = express.Router();

router.get("/me/pregnancy/health-assessments", protect, requireActivePlatformSubscription, getHealthAssessments);
router.get(
  "/me/pregnancy/health-assessments/:conditionSlug",
  protect,
  requireActivePlatformSubscription,
  getHealthAssessment
);
router.put(
  "/me/pregnancy/health-assessments/:conditionSlug",
  protect,
  requireActivePlatformSubscription,
  validateHealthAssessmentPayload,
  saveHealthAssessment
);

export default router;
