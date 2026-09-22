import User from "../models/user.model.js";
import * as patientProfileService from "./patient-profile.service.js";
import { sanitizeUser } from "../utils/sanitize.js";
import AppError from "../utils/AppError.js";

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User account not found", 404);
  }

  if (user.role === "patient") {
    return patientProfileService.getPatientProfile(user._id);
  }

  return sanitizeUser(user);
};

export const updateCurrentUser = async (userId, payload) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User account not found", 404);
  }

  if (user.role !== "patient") {
    throw new AppError(
      "Only patient profile data can currently be updated through this endpoint",
      403
    );
  }

  return patientProfileService.updatePatientProfile(userId, payload);
};

export default {
  getCurrentUser,
  updateCurrentUser,
};
