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
import {
  validateRecordVital,
  validateUpdateVital,
} from "../validators/patient-profile.validator.js";

const router = express.Router();

router.get(
  "/vitals",
  protect,
  patientOnly,
  getVitals
);

router.get(
  "/vitals/report",
  protect,
  patientOnly,
  getVitalsReport
);

router.get(
  "/vitals/summary",
  protect,
  patientOnly,
  getVitalsSummary
);

router.post(
  "/vitals",
  protect,
  patientOnly,
  validateRecordVital,
  recordVital
);

router.patch(
  "/vitals/:vitalId",
  protect,
  patientOnly,
  validateUpdateVital,
  updateVital
);

router.delete(
  "/vitals/:vitalId",
  protect,
  patientOnly,
  deleteVital
);

export default router;
