import * as healthConditionService from "../services/health-condition.service.js";
import { sendSuccess } from "../utils/response.js";

export const getHealthConditions = async (_req, res, next) => {
  try {
    const data = await healthConditionService.getActiveHealthConditions();
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Health conditions retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getHealthConditionBySlug = async (req, res, next) => {
  try {
    const condition = await healthConditionService.getActiveHealthConditionBySlug(req.params.slug);
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Health condition retrieved successfully",
      data: healthConditionService.serializeCondition(condition),
    });
  } catch (error) {
    next(error);
  }
};
