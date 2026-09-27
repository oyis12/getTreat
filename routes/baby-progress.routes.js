import express from "express";

import {
  addGrowthRecordController,
  getGrowthHistoryController,
  getBabyProgressController,
  getBabyProgressReportController,
} from "../controllers/baby-progress.controller.js";

import { validateAddBabyGrowth } from "../validators/baby.validator.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
  "/:babyId/growth",
  protect,
  validateAddBabyGrowth,
  addGrowthRecordController
);

router.get(
  "/:babyId/growth",
  protect,
  getGrowthHistoryController
);

router.get(
  "/:babyId/progress/report",
  protect,
  getBabyProgressReportController
);

router.get(
  "/:babyId/progress",
  protect,
  getBabyProgressController
);

export default router;
