import express from "express";

import {
  getCurrentPregnancy,
  getPregnancyHistory,
  createPregnancy,
  updateCurrentPregnancy,
} from "../controllers/pregnancy.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import validatePregnancyPayload from "../validators/pregnancy.validator.js";

const router = express.Router();

router.get("/me/pregnancy", protect, getCurrentPregnancy);
router.get("/me/pregnancies", protect, getPregnancyHistory);

router.post(
  "/me/pregnancy",
  protect,
  validatePregnancyPayload,
  createPregnancy
);

router.patch(
  "/me/pregnancy",
  protect,
  validatePregnancyPayload,
  updateCurrentPregnancy
);

export default router;
