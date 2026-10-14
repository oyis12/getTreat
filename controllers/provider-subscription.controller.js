import * as subscriptions from "../services/provider-subscription.service.js";
import { sendSuccess } from "../utils/response.js";

const userId = (req) => req.user?._id?.toString?.() ?? req.user?.id;

export const startProviderSubscription = async (req, res, next) => {
  try {
    const data = await subscriptions.startProviderSubscription(userId(req), req.body.provider_service_id, req.autoRenew, req.idempotencyKey);
    return sendSuccess(res, { statusCode: data.reused ? 200 : 201, msg: data.reused ? "Provider service checkout retrieved successfully" : "Provider service checkout initialized successfully", data: data.subscription });
  } catch (error) { next(error); }
};

export const listMyProviderSubscriptions = async (req, res, next) => {
  try {
    const data = await subscriptions.listMyProviderSubscriptions(userId(req), req.pagination);
    return sendSuccess(res, { msg: "Provider subscriptions retrieved successfully", data });
  } catch (error) { next(error); }
};

export const getMyProviderSubscription = async (req, res, next) => {
  try {
    const data = await subscriptions.getMyProviderSubscription(userId(req), req.params.subscriptionId);
    return sendSuccess(res, { msg: "Provider subscription retrieved successfully", data });
  } catch (error) { next(error); }
};

export const setMyProviderSubscriptionAutoRenew = async (req, res, next) => {
  try {
    const data = await subscriptions.setMyProviderSubscriptionAutoRenew(userId(req), req.params.subscriptionId, req.body.enabled);
    return sendSuccess(res, { msg: "Provider subscription auto-renew preference updated successfully", data });
  } catch (error) { next(error); }
};

export const verifyMyProviderSubscriptionPayment = async (req, res, next) => {
  try {
    const data = await subscriptions.verifyMyProviderSubscriptionPayment(userId(req), req.params.subscriptionId, req.body.reference);
    return sendSuccess(res, { msg: "Provider subscription payment status retrieved successfully", data });
  } catch (error) { next(error); }
};

export const receivePaystackWebhook = async (req, res, next) => {
  try {
    await subscriptions.enqueuePaystackWebhook(req.rawBody, req.get("x-paystack-signature"), req.body);
    return sendSuccess(res, { msg: "Paystack webhook received", data: { received: true } });
  } catch (error) { next(error); }
};
