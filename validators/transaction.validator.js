import mongoose from "mongoose";
import AppError from "../utils/AppError.js";

const allowedStatuses = new Set(["all", "initializing", "pending", "success", "failed", "refund_pending", "refund_failed", "reversed", "refunded"]);
const allowedPurposes = new Set(["all", "initial", "renewal", "appointment", "platform_subscription"]);
const allowedSorts = new Set(["newest", "oldest", "highest", "lowest"]);
const allowedQueryKeys = new Set(["page", "limit", "status", "purpose", "sort", "search"]);

export const validateTransactionListQuery = (req, _res, next) => {
  try {
    const unknown = Object.keys(req.query).filter((key) => !allowedQueryKeys.has(key));
    if (unknown.length) throw new AppError(`Unknown transaction query parameter(s): ${unknown.join(", ")}`, 400);

    const { page = "1", limit = "20", status = "all", purpose = "all", sort = "newest", search = "" } = req.query;
    if (typeof page !== "string" || !/^\d+$/.test(page) || Number(page) < 1) throw new AppError("page must be a positive integer", 400);
    if (typeof limit !== "string" || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) throw new AppError("limit must be an integer from 1 to 100", 400);
    if (typeof status !== "string" || !allowedStatuses.has(status)) throw new AppError("status is not a supported transaction state", 400);
    if (typeof purpose !== "string" || !allowedPurposes.has(purpose)) throw new AppError("purpose must be all, initial, renewal, appointment, or platform_subscription", 400);
    if (typeof sort !== "string" || !allowedSorts.has(sort)) throw new AppError("sort must be newest, oldest, highest, or lowest", 400);
    if (typeof search !== "string" || search.length > 100) throw new AppError("search must be text with at most 100 characters", 400);

    req.transactionFilters = {
      page: Number(page),
      limit: Number(limit),
      status,
      purpose,
      sort,
      search: search.trim(),
    };
    next();
  } catch (error) { next(error); }
};

export const validateTransactionId = (req, _res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.transactionId)) throw new AppError("Invalid transaction ID", 400);
    next();
  } catch (error) { next(error); }
};
