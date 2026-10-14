import * as payouts from "../services/provider-payout.service.js";
import { sendSuccess } from "../utils/response.js";

const userId = (req) => req.user?._id?.toString?.() ?? req.user?.id;

export const listBanks = async (_req, res, next) => {
  try { return sendSuccess(res, { msg: "Supported banks retrieved successfully", data: await payouts.listBanks() }); }
  catch (error) { next(error); }
};

export const resolveBankAccount = async (req, res, next) => {
  try {
    const data = await payouts.resolvePayoutBankAccount({ bankCode: req.body.bank_code, accountNumber: req.body.account_number });
    return sendSuccess(res, { msg: "Bank account verified successfully", data });
  } catch (error) { next(error); }
};

export const listPayoutMethods = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Payout methods retrieved successfully", data: await payouts.listPayoutMethods(userId(req)) }); }
  catch (error) { next(error); }
};

export const createPayoutMethod = async (req, res, next) => {
  try {
    const result = await payouts.createPayoutMethod(userId(req), req.body);
    return sendSuccess(res, { statusCode: result.reused ? 200 : 201, msg: result.reused ? "Payout method already exists" : "Payout method added successfully", data: result.method });
  } catch (error) { next(error); }
};

export const setDefaultPayoutMethod = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Default payout method updated successfully", data: await payouts.setDefaultPayoutMethod(userId(req), req.params.methodId) }); }
  catch (error) { next(error); }
};

export const deletePayoutMethod = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Payout method removed successfully", data: await payouts.deletePayoutMethod(userId(req), req.params.methodId) }); }
  catch (error) { next(error); }
};

export const getEarnings = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Provider earnings retrieved successfully", data: await payouts.getProviderEarnings(userId(req)) }); }
  catch (error) { next(error); }
};

export const listProviderPayouts = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Provider payouts retrieved successfully", data: await payouts.listProviderPayouts(userId(req), req.payoutQuery) }); }
  catch (error) { next(error); }
};

export const requestPayout = async (req, res, next) => {
  try {
    const result = await payouts.requestProviderPayout(userId(req), { amountKobo: req.amountKobo, payoutMethodId: req.body.payout_method_id, idempotencyKey: req.idempotencyKey });
    return sendSuccess(res, { statusCode: result.reused ? 200 : 201, msg: result.reused ? "Payout request retrieved successfully" : "Payout request submitted successfully", data: result.payout });
  } catch (error) { next(error); }
};

export const getProviderPayout = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Payout request retrieved successfully", data: await payouts.getProviderPayout(userId(req), req.params.payoutId) }); }
  catch (error) { next(error); }
};

export const listAdminPayouts = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Payout requests retrieved successfully", data: await payouts.listAdminPayouts(req.payoutQuery) }); }
  catch (error) { next(error); }
};

export const getAdminPayout = async (req, res, next) => {
  try { return sendSuccess(res, { msg: "Payout request retrieved successfully", data: await payouts.getAdminPayout(req.params.payoutId) }); }
  catch (error) { next(error); }
};

export const approvePayout = async (req, res, next) => {
  try {
    const actorId = userId(req);
    const data = await payouts.reviewProviderPayout(req.params.payoutId, actorId, { decision: "approve", reason: req.body.reason ?? "", actorRole: req.user.role });
    return sendSuccess(res, { statusCode: data.status === "paid" ? 200 : 202, msg: "Paystack transfer started; awaiting final confirmation", data });
  } catch (error) { next(error); }
};

export const rejectPayout = async (req, res, next) => {
  try {
    const actorId = userId(req);
    const data = await payouts.reviewProviderPayout(req.params.payoutId, actorId, { decision: "reject", reason: req.body.reason ?? "", actorRole: req.user.role });
    return sendSuccess(res, { msg: "Payout request rejected", data });
  } catch (error) { next(error); }
};

export const retryPayout = async (req, res, next) => {
  try {
    const data = await payouts.retryProviderPayout(req.params.payoutId, userId(req), req.user.role);
    return sendSuccess(res, { statusCode: data.status === "paid" ? 200 : 202, msg: "Payout retry submitted; awaiting final confirmation", data });
  } catch (error) { next(error); }
};

export const finalizePayoutTransfer = async (req, res, next) => {
  try {
    const data = await payouts.finalizeProviderPayoutTransfer(req.params.payoutId, userId(req), req.body.otp, req.user.role);
    return sendSuccess(res, { statusCode: data.status === "paid" ? 200 : 202, msg: "Transfer approval submitted; awaiting final confirmation", data });
  } catch (error) { next(error); }
};

export const reconcilePayout = async (req, res, next) => {
  try {
    const data = await payouts.reconcileProviderPayout(req.params.payoutId, userId(req), req.user.role);
    return sendSuccess(res, { statusCode: data.status === "paid" ? 200 : 202, msg: "Paystack transfer status reconciled", data });
  } catch (error) { next(error); }
};
