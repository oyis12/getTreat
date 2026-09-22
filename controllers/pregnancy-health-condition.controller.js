import * as service from "../services/pregnancy-health-condition.service.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

const getUserId = (req) => {
  if (!req.user?.id) throw new AppError("Authentication required", 401);
  return req.user.id;
};

export const addHealthCondition = async (req, res, next) => {
  try {
    const data = await service.addHealthCondition(getUserId(req), req.body);
    return sendSuccess(res, {
      statusCode: 201,
      msg: "Health condition recorded successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateHealthCondition = async (req, res, next) => {
  try {
    const data = await service.updateHealthCondition(
      getUserId(req),
      req.params.conditionId,
      req.body
    );
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Health condition updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const removeHealthCondition = async (req, res, next) => {
  try {
    await service.removeHealthCondition(getUserId(req), req.params.conditionId);
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Health condition removed successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
