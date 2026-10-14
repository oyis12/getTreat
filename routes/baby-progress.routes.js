import express from "express";

import {
  addGrowthRecordController,
  getGrowthHistoryController,
  getBabyProgressController,
  getBabyProgressReportController,
} from "../controllers/baby-progress.controller.js";

import { validateAddBabyGrowth } from "../validators/baby.validator.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";

const router = express.Router();

router.post(
  "/:babyId/growth",
  protect,
  requireActivePlatformSubscription,
  validateAddBabyGrowth,
  addGrowthRecordController
);

router.get(
  "/:babyId/growth",
  protect,
  requireActivePlatformSubscription,
  getGrowthHistoryController
);

router.get(
  "/:babyId/progress/report",
  protect,
  requireActivePlatformSubscription,
  getBabyProgressReportController
);

router.get(
  "/:babyId/progress",
  protect,
  requireActivePlatformSubscription,
  getBabyProgressController
);

export default router;
