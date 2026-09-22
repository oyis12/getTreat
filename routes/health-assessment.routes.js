import express from "express";
import {
  getHealthAssessments,
  getHealthAssessment,
  saveHealthAssessment,
} from "../controllers/health-assessment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import validateHealthAssessmentPayload from "../validators/health-assessment.validator.js";

const router = express.Router();

router.get("/me/pregnancy/health-assessments", protect, getHealthAssessments);
router.get(
  "/me/pregnancy/health-assessments/:conditionSlug",
  protect,
  getHealthAssessment
);
router.put(
  "/me/pregnancy/health-assessments/:conditionSlug",
  protect,
  validateHealthAssessmentPayload,
  saveHealthAssessment
);

export default router;
