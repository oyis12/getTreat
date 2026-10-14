import mongoose from "mongoose";
import AppError from "../utils/AppError.js";

const objectBody = (body) => body && typeof body === "object" && !Array.isArray(body);
const rejectUnknown = (body, allowed, label) => {
  if (!objectBody(body)) throw new AppError(`${label} must be a JSON object`, 400);
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new AppError(`Unknown ${label} field(s): ${unknown.join(", ")}`, 400);
};

export const validateStartProviderSubscription = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["provider_service_id", "auto_renew"], "provider subscription");
    if (!mongoose.isValidObjectId(req.body.provider_service_id)) throw new AppError("A valid provider_service_id is required", 400);
    if (req.body.auto_renew !== undefined && typeof req.body.auto_renew !== "boolean") throw new AppError("auto_renew must be a boolean", 400);
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new AppError("Idempotency-Key header must contain 8 to 128 safe characters", 400);
    req.idempotencyKey = key;
    req.autoRenew = req.body.auto_renew === true;
    next();
  } catch (error) { next(error); }
};

export const validateProviderSubscriptionId = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.subscriptionId)) throw new AppError("Invalid provider subscription ID", 400);
    next();
  } catch (error) { next(error); }
};

export const validateAutoRenew = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["enabled"], "auto-renew");
    if (typeof req.body.enabled !== "boolean") throw new AppError("enabled must be a boolean", 400);
    next();
  } catch (error) { next(error); }
};

export const validatePaymentVerification = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["reference"], "payment verification");
    if (typeof req.body.reference !== "string" || req.body.reference.length < 8 || req.body.reference.length > 100) throw new AppError("A valid payment reference is required", 400);
    next();
  } catch (error) { next(error); }
};

export const validateSubscriptionListQuery = (req, _res, next) => {
  try {
    const { page = "1", limit = "20", status = "all" } = req.query;
    if (!/^\d+$/.test(String(page)) || Number(page) < 1) throw new AppError("page must be a positive integer", 400);
    if (!/^\d+$/.test(String(limit)) || Number(limit) < 1 || Number(limit) > 100) throw new AppError("limit must be an integer from 1 to 100", 400);
    if (!new Set(["all", "pending_payment", "active", "expired", "revoked", "payment_failed"]).has(status)) throw new AppError("status is not a supported provider subscription state", 400);
    req.pagination = { page: Number(page), limit: Number(limit), status };
    next();
  } catch (error) { next(error); }
};
