import * as healthConditionService from "../services/health-condition.service.js";
import { sendSuccess } from "../utils/response.js";

export const createHealthCondition = async (req, res, next) => {
  try {
    const data = await healthConditionService.createHealthCondition(req.body);
    return sendSuccess(res, { statusCode: 201, msg: "Health condition created successfully", data });
  } catch (error) { next(error); }
};

export const listHealthConditions = async (_req, res, next) => {
  try {
    const data = await healthConditionService.getAllHealthConditions();
    return sendSuccess(res, { statusCode: 200, msg: "Health conditions retrieved successfully", data });
  } catch (error) { next(error); }
};

export const updateHealthCondition = async (req, res, next) => {
  try {
    const data = await healthConditionService.updateHealthCondition(req.params.id, req.body);
    return sendSuccess(res, { statusCode: 200, msg: "Health condition updated successfully", data });
  } catch (error) { next(error); }
};
