import { hasActivePlatformSubscription } from "../services/platform-subscription.service.js";
import AppError from "../utils/AppError.js";

export const createPlatformSubscriptionMiddleware = (hasSubscription = hasActivePlatformSubscription) => async (req, _res, next) => {
  try {
    if (req.user?.role !== "patient") return next();
    const userId = req.user?._id?.toString?.() ?? req.user?.id;
    if (!await hasSubscription(userId)) throw new AppError("An active GetTreat platform subscription is required to access this feature", 403);
    next();
  } catch (error) { next(error); }
};

export const requireActivePlatformSubscription = createPlatformSubscriptionMiddleware();
