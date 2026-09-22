import * as userService from "../services/user.service.js";
import * as patientProfileService from "../services/patient-profile.service.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

export const getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const data = await userService.getCurrentUser(req.user.id);

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Current user retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCurrentUser = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const data = await userService.updateCurrentUser(
      req.user.id,
      req.body
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Current user profile updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadCurrentUserAvatar = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    if (!req.file) {
      throw new AppError("Profile image is required", 400);
    }

    const profile = await patientProfileService.updatePatientProfileImage(
      req.user.id,
      {
        secure_url: req.file.path,
        public_id: req.file.filename,
      }
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Profile image uploaded successfully",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCurrentUser,
  updateCurrentUser,
  uploadCurrentUserAvatar,
};
