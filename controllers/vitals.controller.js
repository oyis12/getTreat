import * as vitalsService from "../services/vitals.service.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

const getUserId = (req) => req.user?.id ?? req.user?._id;

export const recordVital = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);

    const data = await vitalsService.recordVital(userId, req.body);

    return sendSuccess(res, {
      statusCode: 201,
      msg: "Vital recorded successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getVitals = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);

    const data = await vitalsService.getVitals(userId, req.query);

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Vitals retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getVitalsReport = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);

    const data = await vitalsService.getVitalsReport(userId, req.query);

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Vital report retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getVitalsSummary = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);

    const data = await vitalsService.getVitalsSummary(userId);

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Vitals summary retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateVital = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);

    const data = await vitalsService.updateVital(
      userId,
      req.params.vitalId,
      req.body
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Vital updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVital = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);

    const data = await vitalsService.deleteVital(userId, req.params.vitalId);

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Vital deleted successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  recordVital,
  getVitals,
  getVitalsReport,
  getVitalsSummary,
  updateVital,
  deleteVital,
};
