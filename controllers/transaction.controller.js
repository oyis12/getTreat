import * as transactions from "../services/transaction.service.js";
import { sendSuccess } from "../utils/response.js";

const userId = (req) => req.user?._id?.toString?.() ?? req.user?.id;

export const listPatientTransactions = async (req, res, next) => {
  try {
    const data = await transactions.listPatientTransactions(userId(req), req.transactionFilters);
    return sendSuccess(res, { msg: "Transactions retrieved successfully", data });
  } catch (error) { next(error); }
};

export const getPatientTransaction = async (req, res, next) => {
  try {
    const data = await transactions.getPatientTransaction(userId(req), req.params.transactionId);
    return sendSuccess(res, { msg: "Transaction retrieved successfully", data });
  } catch (error) { next(error); }
};

export const listProviderTransactions = async (req, res, next) => {
  try {
    const data = await transactions.listProviderTransactions(userId(req), req.transactionFilters);
    return sendSuccess(res, { msg: "Transactions retrieved successfully", data });
  } catch (error) { next(error); }
};

export const getProviderTransaction = async (req, res, next) => {
  try {
    const data = await transactions.getProviderTransaction(userId(req), req.params.transactionId);
    return sendSuccess(res, { msg: "Transaction retrieved successfully", data });
  } catch (error) { next(error); }
};

export const listAdminTransactions = async (req, res, next) => {
  try {
    const data = await transactions.listAdminTransactions(req.transactionFilters);
    return sendSuccess(res, { msg: "Transactions retrieved successfully", data });
  } catch (error) { next(error); }
};

export const getAdminTransaction = async (req, res, next) => {
  try {
    const data = await transactions.getAdminTransaction(req.params.transactionId);
    return sendSuccess(res, { msg: "Transaction retrieved successfully", data });
  } catch (error) { next(error); }
};
