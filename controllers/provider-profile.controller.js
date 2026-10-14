import * as providerProfileService from "../services/provider-profile.service.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

const getUserId = (req) => req.user?._id?.toString?.() ?? req.user?.id;

export const getMyProviderProfile = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);
    const data = await providerProfileService.getProviderProfile(userId);
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Provider profile retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const submitMyProviderProfile = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) throw new AppError("Authentication required", 401);
    const data = await providerProfileService.submitProviderProfile(userId, req.body, req.files ?? {});
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Provider profile submitted successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
