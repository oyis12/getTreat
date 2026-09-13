import express from "express";

import {
  getPatientProfile,
  updatePatientProfile,
} from "../controllers/patient-profile.controller.js";

import { protect } from "../middlewares/auth.middleware.js";

import validatePatientProfileUpdate from "../validators/patient-profile.validator.js";

const router = express.Router();

/**
 * GET /api/patient/profile
 * Get authenticated patient's profile
 */
router.get(
  "/profile",
  protect,
  getPatientProfile
);

/**
 * PATCH /api/patient/profile
 * Update authenticated patient's profile
 */
router.patch(
  "/profile",
  protect,
  validatePatientProfileUpdate,
  updatePatientProfile
);

export default router;