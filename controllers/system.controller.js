import * as systemService from "../services/system.service.js";
import { sendSuccess } from "../utils/response.js";

export const getSubscriptions = async (_req, res, next) => {
  try {
    const data = await systemService.getPlatformSubscription();
    return sendSuccess(res, { statusCode: 200, msg: "Platform subscription configuration retrieved successfully", data });
  } catch (error) { next(error); }
};

export const getPreferredChoices = async (_req, res, next) => {
  try {
    const data = await systemService.getPreferredChoices();
    return sendSuccess(res, { statusCode: 200, msg: "Preferred choices retrieved successfully", data });
  } catch (error) { next(error); }
};

export const getPreferredChoice = async (req, res, next) => {
  try {
    const data = await systemService.getPreferredChoice(req.params.id);
    return sendSuccess(res, { statusCode: 200, msg: "Preferred choice retrieved successfully", data });
  } catch (error) { next(error); }
};
