import express from "express";

import {
  getPatientProfile,
  updatePatientProfile,
  uploadPatientProfileImage,
} from "../controllers/patient-profile.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { patientOnly } from "../middlewares/role.middleware.js";
import uploadPatientProfileImageMiddleware from "../middlewares/upload.middleware.js";

import validatePatientProfileUpdate from "../validators/patient-profile.validator.js";

const router = express.Router();

router.get(
  "/profile",
  protect,
  getPatientProfile
);

router.patch(
  "/profile",
  protect,
  validatePatientProfileUpdate,
  updatePatientProfile
);

router.post(
  "/profile/image",
  protect,
  patientOnly,
  uploadPatientProfileImageMiddleware,
  uploadPatientProfileImage
);

export default router;