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