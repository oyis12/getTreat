import express from "express";

import {
  getCurrentUser,
  updateCurrentUser,
  uploadCurrentUserAvatar,
} from "../controllers/user.controller.js";

import babyRoutes from "./baby.routes.js";

import { protect } from "../middlewares/auth.middleware.js";
import uploadPatientProfileImageMiddleware from "../middlewares/upload.middleware.js";
import validatePatientProfileUpdate from "../validators/patient-profile.validator.js";

const router = express.Router();


router.get("/me", protect, getCurrentUser);

router.patch(
  "/me",
  protect,
  validatePatientProfileUpdate,
  updateCurrentUser
);

router.post(
  "/me/avatar",
  protect,
  uploadPatientProfileImageMiddleware,
  uploadCurrentUserAvatar
);

// Baby routes
router.use("/me/babies", babyRoutes);

export default router;
