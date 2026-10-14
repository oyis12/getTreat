import express from "express";

import {
  getCurrentPregnancy,
  getPregnancyHistory,
  createPregnancy,
  updateCurrentPregnancy,
} from "../controllers/pregnancy.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import validatePregnancyPayload from "../validators/pregnancy.validator.js";
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";

const router = express.Router();

router.get("/me/pregnancy", protect, requireActivePlatformSubscription, getCurrentPregnancy);
router.get("/me/pregnancies", protect, requireActivePlatformSubscription, getPregnancyHistory);

router.post(
  "/me/pregnancy",
  protect,
  requireActivePlatformSubscription,
  validatePregnancyPayload,
  createPregnancy
);

router.patch(
  "/me/pregnancy",
  protect,
  requireActivePlatformSubscription,
  validatePregnancyPayload,
  updateCurrentPregnancy
);

export default router;
