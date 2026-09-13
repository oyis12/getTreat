import * as patientProfileService from "../services/patient-profile.service.js";
import AppError  from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

export const getPatientProfile = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user?.id) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    const data =
      await patientProfileService.getPatientProfile(
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Patient profile retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePatientProfile = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user?.id) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    const data =
      await patientProfileService.updatePatientProfile(
        req.user.id,
        req.body
      );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Patient profile updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
export const uploadPatientProfileImage = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    if (!req.file) {
      throw new AppError(
        "Profile image is required",
        400
      );
    }

    const data = await patientProfileService.updatePatientProfileImage(
      req.user.id,
      {
        secure_url: req.file.path,
        public_id: req.file.filename,
      }
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Profile image uploaded successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
