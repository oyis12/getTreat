import mongoose from "mongoose";
import AppError from "../utils/AppError.js";

const rejectUnknown = (body, allowed, label) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(`${label} must be a JSON object`, 400);
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new AppError(`Unknown ${label} field(s): ${unknown.join(", ")}`, 400);
};

export const validatePlatformFeeUpdate = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["platform_fee_percent"], "platform financial settings");
    const rate = req.body.platform_fee_percent;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 100 || Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-7) {
      throw new AppError("platform_fee_percent must be a number from 0 to 100 with at most two decimal places", 400);
    }
    next();
  } catch (error) { next(error); }
};

export const validatePayoutMethodId = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.methodId)) throw new AppError("Invalid payout method ID", 400);
    next();
  } catch (error) { next(error); }
};

export const validatePayoutMethodBody = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["bank_code", "account_number", "confirmed_account_name"], "payout method");
    if (typeof req.body.bank_code !== "string" || !/^[A-Za-z0-9_-]{1,20}$/.test(req.body.bank_code)) throw new AppError("A valid bank_code is required", 400);
    if (typeof req.body.account_number !== "string" || !/^\d{10}$/.test(req.body.account_number)) throw new AppError("Nigerian account_number must contain 10 digits", 400);
    if (typeof req.body.confirmed_account_name !== "string" || req.body.confirmed_account_name.trim().length < 2 || req.body.confirmed_account_name.trim().length > 160) throw new AppError("confirmed_account_name is required and must be between 2 and 160 characters", 400);
    next();
  } catch (error) { next(error); }
};

export const validatePayoutMethodResolution = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["bank_code", "account_number"], "payout account resolution");
    if (typeof req.body.bank_code !== "string" || !/^[A-Za-z0-9_-]{1,20}$/.test(req.body.bank_code)) throw new AppError("A valid bank_code is required", 400);
    if (typeof req.body.account_number !== "string" || !/^\d{10}$/.test(req.body.account_number)) throw new AppError("Nigerian account_number must contain 10 digits", 400);
    next();
  } catch (error) { next(error); }
};

export const validatePayoutRequest = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["amount", "payout_method_id"], "payout request");
    if (typeof req.body.amount !== "number" || !Number.isFinite(req.body.amount) || req.body.amount <= 0 || !Number.isSafeInteger(Math.round(req.body.amount * 100))) throw new AppError("amount must be a positive NGN amount with at most two decimal places", 400);
    if (Math.abs(req.body.amount * 100 - Math.round(req.body.amount * 100)) > 1e-7) throw new AppError("amount must have at most two decimal places", 400);
    if (req.body.payout_method_id !== undefined && !mongoose.isValidObjectId(req.body.payout_method_id)) throw new AppError("Invalid payout_method_id", 400);
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new AppError("Idempotency-Key header must contain 8 to 128 safe characters", 400);
    req.idempotencyKey = key;
    req.amountKobo = Math.round(req.body.amount * 100);
    next();
  } catch (error) { next(error); }
};

export const validatePayoutId = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.payoutId)) throw new AppError("Invalid payout ID", 400);
    next();
  } catch (error) { next(error); }
};

export const validatePayoutDecision = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["reason"], "payout decision");
    if (req.body.reason !== undefined && (typeof req.body.reason !== "string" || req.body.reason.trim().length > 300)) throw new AppError("reason must be a string no longer than 300 characters", 400);
    next();
  } catch (error) { next(error); }
};

export const validatePayoutFinalize = (req, _res, next) => {
  try {
    rejectUnknown(req.body, ["otp"], "transfer finalization");
    if (typeof req.body.otp !== "string" || !/^\d{4,8}$/.test(req.body.otp)) throw new AppError("otp must contain 4 to 8 digits", 400);
    next();
  } catch (error) { next(error); }
};

export const validatePayoutListQuery = (req, _res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const status = req.query.status ?? "all";
    const allowed = ["all", "requested", "approved", "processing", "otp_required", "paid", "rejected", "failed", "reversed"];
    if (!Number.isInteger(page) || page < 1) throw new AppError("page must be a positive integer", 400);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError("limit must be an integer from 1 to 100", 400);
    if (!allowed.includes(status)) throw new AppError("Unsupported payout status", 400);
    const unknown = Object.keys(req.query).filter((key) => !["page", "limit", "status"].includes(key));
    if (unknown.length) throw new AppError(`Unknown payout query parameter(s): ${unknown.join(", ")}`, 400);
    req.payoutQuery = { page, limit, status };
    next();
  } catch (error) { next(error); }
};
