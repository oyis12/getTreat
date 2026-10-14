import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
const only = (body, fields, label) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(`${label} must be a JSON object`, 400);
  const unknown = Object.keys(body).filter((field) => !fields.includes(field));
  if (unknown.length) throw new AppError(`Unknown ${label} field(s): ${unknown.join(", ")}`, 400);
};
export const validateStartPlatformSubscription = (req, _res, next) => { try {
  only(req.body, ["billing_cycle", "auto_renew"], "platform subscription");
  if (!new Set(["monthly", "quarterly", "yearly"]).has(req.body.billing_cycle)) throw new AppError("billing_cycle must be monthly, quarterly or yearly", 400);
  if (req.body.auto_renew !== undefined && typeof req.body.auto_renew !== "boolean") throw new AppError("auto_renew must be a boolean", 400);
  const key = req.get("Idempotency-Key"); if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new AppError("Idempotency-Key header must contain 8 to 128 safe characters", 400);
  req.idempotencyKey = key; req.autoRenew = req.body.auto_renew === true; next();
} catch (error) { next(error); } };
export const validatePlatformSubscriptionId = (req, _res, next) => { try { if (!mongoose.isValidObjectId(req.params.subscriptionId)) throw new AppError("Invalid platform subscription ID", 400); next(); } catch (error) { next(error); } };
export const validatePlatformAutoRenew = (req, _res, next) => { try { only(req.body, ["enabled"], "auto-renew"); if (typeof req.body.enabled !== "boolean") throw new AppError("enabled must be a boolean", 400); next(); } catch (error) { next(error); } };
export const validatePlatformPaymentVerification = (req, _res, next) => { try { only(req.body, ["reference"], "payment verification"); if (typeof req.body.reference !== "string" || req.body.reference.length < 8 || req.body.reference.length > 100) throw new AppError("A valid payment reference is required", 400); next(); } catch (error) { next(error); } };
export const validatePlatformPlansUpdate = (req, _res, next) => { try {
  only(req.body, ["enabled", "plans"], "platform subscription settings");
  if (typeof req.body.enabled !== "boolean") throw new AppError("enabled must be a boolean", 400);
  if (!Array.isArray(req.body.plans) || req.body.plans.length !== 3) throw new AppError("plans must include monthly, quarterly and yearly", 400);
  const cycles = new Set();
  for (const plan of req.body.plans) {
    only(plan, ["billing_cycle", "amount", "active"], "plan");
    if (!new Set(["monthly", "quarterly", "yearly"]).has(plan.billing_cycle) || cycles.has(plan.billing_cycle)) throw new AppError("Each plan must have a unique supported billing_cycle", 400);
    cycles.add(plan.billing_cycle);
    if (!Number.isFinite(plan.amount) || plan.amount < 1 || plan.amount > 100000000 || Math.round(plan.amount * 100) > Number.MAX_SAFE_INTEGER) throw new AppError("Plan amount must be between ₦1 and ₦100,000,000", 400);
    if (typeof plan.active !== "boolean") throw new AppError("Plan active must be a boolean", 400);
  }
  if (cycles.size !== 3) throw new AppError("Monthly, quarterly and yearly plans are required", 400);
  req.body.plans.sort((a, b) => ["monthly", "quarterly", "yearly"].indexOf(a.billing_cycle) - ["monthly", "quarterly", "yearly"].indexOf(b.billing_cycle)); next();
} catch (error) { next(error); } };
