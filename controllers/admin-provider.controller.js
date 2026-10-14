import * as providerProfileService from "../services/provider-profile.service.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

const getUserId = (req) => req.user?._id?.toString?.() ?? req.user?.id;

export const listProvidersForReview = async (req, res, next) => {
  try {
    const data = await providerProfileService.listProviderProfiles({
      status: req.approvalStatus,
      ...req.pagination,
    });
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Provider profiles retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const reviewProvider = async (req, res, next) => {
  try {
    const adminUserId = getUserId(req);
    if (!adminUserId) throw new AppError("Authentication required", 401);
    const data = await providerProfileService.reviewProviderProfile(
      req.params.providerProfileId,
      req.body.approval_status,
      adminUserId
    );
    return sendSuccess(res, {
      statusCode: 200,
      msg: "Provider approval status updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
