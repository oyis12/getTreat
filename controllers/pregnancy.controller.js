import * as pregnancyService from "../services/pregnancy.service.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

export const getCurrentPregnancy = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const data = await pregnancyService.getCurrentPregnancyForUser(req.user.id);

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Current pregnancy retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPregnancyHistory = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const data = await pregnancyService.getPregnancyHistoryForUser(req.user.id);

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Pregnancy history retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createPregnancy = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const data = await pregnancyService.createPregnancy(
      req.user.id,
      req.body
    );

    return sendSuccess(res, {
      statusCode: 201,
      msg: "Pregnancy created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCurrentPregnancy = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const data = await pregnancyService.updateCurrentPregnancy(
      req.user.id,
      req.body
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Pregnancy updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
