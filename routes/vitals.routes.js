import express from "express";

import {
  deleteVital,
  getVitals,
  getVitalsReport,
  getVitalsSummary,
  recordVital,
  updateVital,
} from "../controllers/vitals.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { patientOnly } from "../middlewares/role.middleware.js";
import { requireActivePlatformSubscription } from "../middlewares/platform-subscription.middleware.js";
import {
  validateRecordVital,
  validateUpdateVital,
} from "../validators/patient-profile.validator.js";

const router = express.Router();

router.get(
  "/vitals",
  protect,
  patientOnly,
  requireActivePlatformSubscription,
  getVitals
);

router.get(
  "/vitals/report",
  protect,
  patientOnly,
  requireActivePlatformSubscription,
  getVitalsReport
);

router.get(
  "/vitals/summary",
  protect,
  patientOnly,
  requireActivePlatformSubscription,
  getVitalsSummary
);

router.post(
  "/vitals",
  protect,
  patientOnly,
  requireActivePlatformSubscription,
  validateRecordVital,
  recordVital
);

router.patch(
  "/vitals/:vitalId",
  protect,
  patientOnly,
  requireActivePlatformSubscription,
  validateUpdateVital,
  updateVital
);

router.delete(
  "/vitals/:vitalId",
  protect,
  patientOnly,
  requireActivePlatformSubscription,
  deleteVital
);

export default router;
