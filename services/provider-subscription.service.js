import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import PatientProfile from "../models/patient-profile.model.js";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderService from "../models/provider-service.model.js";
import ProviderSubscription from "../models/provider-subscription.model.js";
import ProviderPaymentAttempt from "../models/provider-payment-attempt.model.js";
import System from "../models/system.model.js";
import PaymentAuthorization from "../models/payment-authorization.model.js";
import PaystackWebhookEvent from "../models/paystack-webhook-event.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import { env } from "../config/env.js";
import {
  assertPaymentTokenEncryptionConfigured,
  decryptPaymentToken,
  encryptPaymentToken,
  hashPaymentSignature,
} from "../utils/payment-token-crypto.js";
import {
  chargePaystackAuthorization,
  getPaystackTransaction,
  initializePaystackCheckout,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "./paystack.service.js";
import { calculateProviderPaymentSplit, postProviderPaymentEarnings, reverseProviderPaymentEarnings, writeAuditEvent } from "./financial-ledger.service.js";

const validId = (id) => mongoose.isValidObjectId(id);
const newReference = () => `gt4m${randomBytes(18).toString("hex")}`;
const addDays = (date, days) => new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);

export const addBillingCycle = (date, cadence) => {
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[cadence];
  if (!months) throw new AppError("Unsupported provider service billing cycle", 400);
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
};

export const getProviderRenewalRetryAt = (periodEnd, failedAttemptNumber) => {
  if (!Number.isInteger(failedAttemptNumber) || failedAttemptNumber < 1 || failedAttemptNumber >= env.providerRenewalMaxAttempts) return null;
  const retryAt = addDays(periodEnd, env.providerRenewalRetryIntervalDays * failedAttemptNumber);
  const graceEnd = addDays(periodEnd, env.providerRenewalGraceDays);
  return retryAt < graceEnd ? retryAt : null;
};

const getPatientContext = async (userId) => {
  if (!validId(userId)) throw new AppError("Authentication required", 401);
  const user = await User.findById(userId).select("email emailVerified accountStatus role fullname");
  if (!user || user.role !== "patient" || !user.emailVerified || user.accountStatus !== "active") {
    throw new AppError("An active verified patient account is required", 403);
  }
  const profile = await PatientProfile.findOne({ user: user._id }).select("_id user");
  if (!profile) throw new AppError("Patient profile not found", 404);
  return { user, profile };
};

const discountedPrice = (service) => Number((service.original_price * (1 - (service.discount_percent || 0) / 100)).toFixed(2));

const serializeSubscription = (subscription, latestAttempt = null) => ({
  id: subscription._id.toString(),
  provider_service_id: subscription.provider_service?._id?.toString?.() ?? subscription.provider_service?.toString?.() ?? null,
  provider_profile_id: subscription.provider_profile?._id?.toString?.() ?? subscription.provider_profile?.toString?.() ?? null,
  patient_profile_id: subscription.patient_profile?._id?.toString?.() ?? subscription.patient_profile?.toString?.() ?? null,
  service: subscription.service_snapshot,
  status: subscription.status,
  starts_at: subscription.starts_at ?? null,
  ends_at: subscription.ends_at ?? null,
  auto_renew: subscription.auto_renew,
  auto_renew_consent_at: subscription.auto_renew_consent_at ?? null,
  auto_renew_disabled_at: subscription.auto_renew_disabled_at ?? null,
  renewal_grace_ends_at: subscription.renewal_grace_ends_at ?? null,
  renewal_attempts: subscription.renewal_attempts ?? 0,
  latest_payment: latestAttempt ? {
    reference: latestAttempt.reference,
    status: latestAttempt.status,
    amount: Number((latestAttempt.amount_kobo / 100).toFixed(2)),
    currency: latestAttempt.currency,
    authorization_url: latestAttempt.authorization_url ?? null,
    created_at: latestAttempt.createdAt,
  } : null,
  created_at: subscription.createdAt,
  modified_at: subscription.modifiedAt,
});

const populateSubscription = (subscription) => subscription.populate({
  path: "provider_profile",
  select: "professional_field professional_field_other user",
  populate: { path: "user", select: "fullname" },
});

const getLatestAttempt = (subscriptionId) => ProviderPaymentAttempt.findOne({ provider_subscription: subscriptionId }).sort({ createdAt: -1 });

const serializeWithLatestAttempt = async (subscription) => {
  const populated = await populateSubscription(subscription);
  const latest = await getLatestAttempt(subscription._id);
  const result = serializeSubscription(populated, latest);
  const providerProfile = populated.provider_profile;
  result.provider = providerProfile ? {
    fullname: providerProfile.user?.fullname ?? null,
    professional_field: providerProfile.professional_field,
    profession: providerProfile.professional_field === "others" ? providerProfile.professional_field_other ?? "Others" : providerProfile.professional_field,
  } : null;
  return result;
};

const metadataObject = (value) => {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" ? value : {};
};

const buildCheckoutResponse = async (attempt, subscription, reused = false) => ({
  reused,
  subscription: {
    ...(await serializeWithLatestAttempt(subscription)),
    payment: {
      reference: attempt.reference,
      status: attempt.status,
      authorization_url: attempt.authorization_url,
      access_code: attempt.access_code,
    },
  },
});

const ensureProviderAndService = async (serviceId) => {
  if (!validId(serviceId)) throw new AppError("Invalid provider service ID", 400);
  const service = await ProviderService.findOne({ _id: serviceId, active: true });
  if (!service) throw new AppError("Active provider service not found", 404);
  const profile = await ProviderProfile.findById(service.provider_profile);
  if (!profile || profile.approval_status !== "approved") throw new AppError("Provider is not approved to sell services", 403);
  const providerUser = await User.findById(profile.user).select("role emailVerified accountStatus");
  if (!providerUser || providerUser.role !== "provider" || !providerUser.emailVerified || providerUser.accountStatus !== "active") {
    throw new AppError("Provider account is not active", 403);
  }
  return { service, profile };
};

const checkoutFromAttempt = async (attempt, subscription) => {
  if (attempt.status === "failed") throw new AppError("This checkout attempt failed. Start a new attempt with a new Idempotency-Key", 409);
  return buildCheckoutResponse(attempt, subscription, true);
};

export const startProviderSubscription = async (userId, serviceId, autoRenew, idempotencyKey) => {
  const { user, profile: patientProfile } = await getPatientContext(userId);
  const existingAttempt = await ProviderPaymentAttempt.findOne({ patient_profile: patientProfile._id, idempotency_key: idempotencyKey });
  if (existingAttempt) {
    const existingSubscription = await ProviderSubscription.findById(existingAttempt.provider_subscription);
    if (!existingSubscription || existingAttempt.provider_service.toString() !== serviceId.toString() || existingAttempt.requested_auto_renew !== autoRenew) {
      throw new AppError("Idempotency-Key was already used for a different request", 409);
    }
    return checkoutFromAttempt(existingAttempt, existingSubscription);
  }

  if (autoRenew) assertPaymentTokenEncryptionConfigured();
  const { service, profile: providerProfile } = await ensureProviderAndService(serviceId);
  const now = new Date();
  await ProviderSubscription.updateMany(
    {
      patient_profile: patientProfile._id,
      provider_service: service._id,
      status: "active",
      ends_at: { $lte: now },
      $or: [{ renewal_grace_ends_at: null }, { renewal_grace_ends_at: { $lte: now } }],
    },
    { $set: { status: "expired", auto_renew: false, next_renewal_attempt_at: null, renewal_lock_until: null } }
  );
  const alreadyActive = await ProviderSubscription.findOne({
    patient_profile: patientProfile._id,
    provider_service: service._id,
    status: "active",
    starts_at: { $lte: now },
    $or: [{ ends_at: { $gt: now } }, { renewal_grace_ends_at: { $gt: now } }],
  });
  if (alreadyActive) throw new AppError("You already have an active subscription to this provider service", 409);

  const pendingAttempt = await ProviderPaymentAttempt.findOne({
    patient_profile: patientProfile._id,
    provider_service: service._id,
    status: { $in: ["initializing", "pending"] },
  }).sort({ createdAt: -1 });
  if (pendingAttempt) {
    if (pendingAttempt.requested_auto_renew !== autoRenew) {
      throw new AppError("An unfinished checkout exists with a different auto-renew choice. Complete or abandon that checkout first", 409);
    }
    const pendingSubscription = await ProviderSubscription.findById(pendingAttempt.provider_subscription);
    if (pendingSubscription) return checkoutFromAttempt(pendingAttempt, pendingSubscription);
  }

  const price = discountedPrice(service);
  const amountKobo = Math.round(price * 100);
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 1) throw new AppError("Provider service price is invalid for Paystack", 422);
  const globalSystem = await System.findOne({ key: "global" }).select("platform_fee_percent").lean();
  const commissionRate = Number(globalSystem?.platform_fee_percent ?? 15);
  const earningsSplit = calculateProviderPaymentSplit(amountKobo, commissionRate);
  const serviceSnapshot = {
    title: service.title,
    original_price: service.original_price,
    discount_percent: service.discount_percent || 0,
    discounted_price: price,
    currency: service.currency,
    billing_cycle: service.billing_cycle,
  };
  const reference = newReference();
  let subscription;
  let attempt;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      [subscription] = await ProviderSubscription.create([{
        provider_profile: providerProfile._id,
        provider_service: service._id,
        patient_profile: patientProfile._id,
        service_snapshot: serviceSnapshot,
        status: "pending_payment",
        auto_renew: autoRenew,
        auto_renew_consent_at: autoRenew ? new Date() : null,
      }], { session });
      [attempt] = await ProviderPaymentAttempt.create([{
        provider_subscription: subscription._id,
        provider_service: service._id,
        provider_profile: providerProfile._id,
        patient_profile: patientProfile._id,
        purpose: "initial",
        status: "initializing",
        reference,
        idempotency_key: idempotencyKey,
        requested_auto_renew: autoRenew,
        amount_kobo: amountKobo,
        commission_rate_percent: commissionRate,
        platform_fee_kobo: earningsSplit.platformFeeKobo,
        provider_net_kobo: earningsSplit.providerNetKobo,
        commission_snapshotted_at: now,
        commission_snapshot_source: "checkout_initialization",
        billing_email: user.email,
      }], { session });
      await writeAuditEvent({ eventKey: `provider-payment:${attempt._id}:status:initializing`, actor: user._id, actorRole: "patient", action: "provider_payment_status_changed", resourceType: "provider_payment_attempt", resourceId: attempt._id, newState: "initializing", correlationId: attempt.reference, metadata: { amount_kobo: amountKobo }, session });
    });
  } catch (error) {
    if (error.code === 11000) {
      const raced = await ProviderPaymentAttempt.findOne({ patient_profile: patientProfile._id, idempotency_key: idempotencyKey });
      if (raced) return checkoutFromAttempt(raced, await ProviderSubscription.findById(raced.provider_subscription));
    }
    throw error;
  } finally {
    await session.endSession();
  }

  try {
    const result = await initializePaystackCheckout({
      email: user.email,
      amountKobo,
      reference,
      recurring: autoRenew,
      metadata: {
        purpose: "provider_service_subscription",
        payment_attempt_id: attempt._id.toString(),
        provider_subscription_id: subscription._id.toString(),
        provider_service_id: service._id.toString(),
        patient_profile_id: patientProfile._id.toString(),
        auto_renew: autoRenew,
      },
    });
    if (result.reference !== reference || !result.authorization_url) throw new AppError("Paystack returned an invalid checkout response", 502);
    attempt.status = "pending";
    attempt.authorization_url = result.authorization_url;
    attempt.access_code = result.access_code ?? null;
    await attempt.save();
    await writeAuditEvent({ eventKey: `provider-payment:${attempt._id}:status:pending`, actor: user._id, actorRole: "patient", action: "provider_payment_status_changed", resourceType: "provider_payment_attempt", resourceId: attempt._id, priorState: "initializing", newState: "pending", correlationId: attempt.reference });
  } catch (error) {
    attempt.status = "failed";
    attempt.failure_reason = error.message.slice(0, 300);
    await attempt.save();
    await writeAuditEvent({ eventKey: `provider-payment:${attempt._id}:status:failed`, actorRole: "system", action: "provider_payment_status_changed", resourceType: "provider_payment_attempt", resourceId: attempt._id, priorState: "initializing", newState: "failed", correlationId: attempt.reference });
    subscription.status = "payment_failed";
    await subscription.save();
    throw error;
  }
  return buildCheckoutResponse(attempt, subscription);
};

export const listMyProviderSubscriptions = async (userId, { page, limit, status }) => {
  const { profile } = await getPatientContext(userId);
  const filter = { patient_profile: profile._id, ...(status === "all" ? {} : { status }) };
  const [items, total] = await Promise.all([
    ProviderSubscription.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ProviderSubscription.countDocuments(filter),
  ]);
  return {
    items: await Promise.all(items.map(serializeWithLatestAttempt)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

export const getMyProviderSubscription = async (userId, subscriptionId) => {
  const { profile } = await getPatientContext(userId);
  const subscription = await ProviderSubscription.findOne({ _id: subscriptionId, patient_profile: profile._id });
  if (!subscription) throw new AppError("Provider subscription not found", 404);
  return serializeWithLatestAttempt(subscription);
};

export const setMyProviderSubscriptionAutoRenew = async (userId, subscriptionId, enabled) => {
  const { profile } = await getPatientContext(userId);
  const subscription = await ProviderSubscription.findOne({ _id: subscriptionId, patient_profile: profile._id });
  if (!subscription) throw new AppError("Provider subscription not found", 404);
  if (subscription.status !== "active") throw new AppError("Auto-renew can only be changed on an active subscription", 409);

  if (enabled) {
    const authorization = await PaymentAuthorization.findOne({ patient_profile: profile._id, active: true, reusable: true }).sort({ createdAt: -1 });
    if (!authorization) throw new AppError("Complete a Paystack checkout with auto-renew enabled before turning on automatic renewal", 409);
    if (!subscription.ends_at || subscription.ends_at <= new Date()) throw new AppError("This subscription is already in its renewal period; contact support to restart it", 409);
    subscription.payment_authorization = authorization._id;
    subscription.auto_renew = true;
    subscription.auto_renew_consent_at = new Date();
    subscription.auto_renew_disabled_at = null;
    subscription.renewal_attempts = 0;
    subscription.renewal_grace_ends_at = addDays(subscription.ends_at, env.providerRenewalGraceDays);
    subscription.next_renewal_attempt_at = subscription.ends_at;
  } else {
    subscription.auto_renew = false;
    subscription.auto_renew_disabled_at = new Date();
    subscription.renewal_grace_ends_at = null;
    subscription.next_renewal_attempt_at = null;
    subscription.renewal_lock_until = null;
  }
  await subscription.save();
  return serializeWithLatestAttempt(subscription);
};

const assertVerifiedPayment = (attempt, paystackData) => {
  if (paystackData.reference !== attempt.reference || paystackData.amount !== attempt.amount_kobo || paystackData.currency !== attempt.currency) {
    throw new AppError("Paystack payment does not match the expected purchase", 409);
  }
  const metadata = metadataObject(paystackData.metadata);
  const paidEmail = paystackData.customer?.email?.toLowerCase?.();
  if (!paidEmail || paidEmail !== attempt.billing_email.toLowerCase()) throw new AppError("Paystack customer does not match the purchase", 409);
  if (metadata.payment_attempt_id !== attempt._id.toString() || metadata.provider_subscription_id !== attempt.provider_subscription.toString() || metadata.provider_service_id !== attempt.provider_service.toString()) {
    throw new AppError("Paystack payment metadata does not match the purchase", 409);
  }
};

const persistAuthorization = async (attempt, subscription, paystackData, session) => {
  if (!subscription.auto_renew) return null;
  const authorization = paystackData.authorization;
  if (!authorization?.reusable || !authorization.authorization_code || !authorization.signature) return null;
  const encrypted = encryptPaymentToken(authorization.authorization_code);
  const signatureHash = hashPaymentSignature(authorization.signature);
  const stored = await PaymentAuthorization.findOneAndUpdate(
    { patient_profile: attempt.patient_profile, signature_hash: signatureHash },
    { $setOnInsert: {
      patient_profile: attempt.patient_profile,
      billing_email: attempt.billing_email,
      paystack_customer_code: paystackData.customer?.customer_code ?? null,
      authorization_code_encrypted: encrypted.ciphertext,
      authorization_iv: encrypted.iv,
      authorization_tag: encrypted.tag,
      signature_hash: signatureHash,
      reusable: true,
      active: true,
      channel: authorization.channel ?? null,
    } },
    { upsert: true, new: true, session, setDefaultsOnInsert: true }
  );
  return stored._id;
};

export const fulfillVerifiedPayment = async (reference, paystackData) => {
  const initialAttempt = await ProviderPaymentAttempt.findOne({ reference });
  if (!initialAttempt) throw new AppError("Payment reference not found", 404);
  if (paystackData.status !== "success") return settleNonSuccess(initialAttempt, paystackData);
  assertVerifiedPayment(initialAttempt, paystackData);

  const session = await mongoose.startSession();
  let subscriptionId = initialAttempt.provider_subscription;
  try {
    await session.withTransaction(async () => {
      const attempt = await ProviderPaymentAttempt.findById(initialAttempt._id).session(session);
      if (!attempt) throw new AppError("Payment attempt not found", 404);
      if (attempt.status === "success") return;
      if (["reversed", "refunded"].includes(attempt.status)) return;
      const previousAttemptStatus = attempt.status;
      const subscription = await ProviderSubscription.findById(attempt.provider_subscription).session(session);
      if (!subscription) throw new AppError("Provider subscription not found", 404);
      if (!attempt.commission_snapshotted_at) {
        const system = await System.findOne({ key: "global" }).select("platform_fee_percent").session(session).lean();
        const rate = Number(system?.platform_fee_percent ?? 15);
        const split = calculateProviderPaymentSplit(attempt.amount_kobo, rate);
        attempt.commission_rate_percent = rate;
        attempt.platform_fee_kobo = split.platformFeeKobo;
        attempt.provider_net_kobo = split.providerNetKobo;
        attempt.commission_snapshotted_at = new Date();
        attempt.commission_snapshot_source = "legacy_fulfillment";
      }
      const authId = await persistAuthorization(attempt, subscription, paystackData, session);
      const now = new Date();
      const periodStart = attempt.purpose === "renewal" && subscription.ends_at ? new Date(subscription.ends_at) : now;
      const nextEnd = addBillingCycle(periodStart, subscription.service_snapshot.billing_cycle);
      subscription.status = "active";
      if (attempt.purpose === "initial") subscription.starts_at = periodStart;
      subscription.ends_at = nextEnd;
      subscription.payment_authorization = authId ?? subscription.payment_authorization;
      if (attempt.purpose === "initial" && subscription.auto_renew && !authId) subscription.auto_renew = false;
      subscription.renewal_attempts = 0;
      subscription.renewal_grace_ends_at = subscription.auto_renew ? addDays(nextEnd, env.providerRenewalGraceDays) : null;
      subscription.next_renewal_attempt_at = subscription.auto_renew ? nextEnd : null;
      subscription.renewal_lock_until = null;
      await subscription.save({ session });

      attempt.status = "success";
      attempt.gateway_transaction_id = paystackData.id == null ? null : String(paystackData.id);
      attempt.verified_at = now;
      attempt.failure_reason = null;
      await attempt.save({ session });
      await postProviderPaymentEarnings(attempt, { session });
      await writeAuditEvent({
        eventKey: `provider-payment:${attempt._id}:status:success`,
        actorRole: "system",
        action: "provider_payment_status_changed",
        resourceType: "provider_payment_attempt",
        resourceId: attempt._id,
        priorState: previousAttemptStatus,
        newState: "success",
        correlationId: attempt.reference,
        metadata: { gateway_transaction_id: attempt.gateway_transaction_id },
        session,
      });
    });
  } finally {
    await session.endSession();
  }
  const subscription = await ProviderSubscription.findById(subscriptionId);
  return { subscription: await serializeWithLatestAttempt(subscription), payment_status: "success" };
};

const settleNonSuccess = async (attempt, paystackData) => {
  const status = paystackData.status;
  const now = new Date();
  if (["pending", "processing", "ongoing", "queued"].includes(status)) {
    const changed = await ProviderPaymentAttempt.findOneAndUpdate({ _id: attempt._id, status: { $nin: ["success", "reversed", "refunded"] } }, { $set: { status: "pending" } }, { new: true });
    if (changed && attempt.status !== "pending") await writeAuditEvent({ eventKey: `provider-payment:${attempt._id}:status:pending`, actorRole: "system", action: "provider_payment_status_changed", resourceType: "provider_payment_attempt", resourceId: attempt._id, priorState: attempt.status, newState: "pending", correlationId: attempt.reference });
    return { subscription: await serializeWithLatestAttempt(await ProviderSubscription.findById(attempt.provider_subscription)), payment_status: "pending" };
  }
  if (status === "reversed") {
    await revokeSubscriptionForPayment(attempt.reference, "reversed");
    return { subscription: await serializeWithLatestAttempt(await ProviderSubscription.findById(attempt.provider_subscription)), payment_status: "reversed" };
  }
  if (["failed", "abandoned"].includes(status)) {
    const changed = await ProviderPaymentAttempt.findOneAndUpdate({ _id: attempt._id, status: { $nin: ["success", "reversed", "refunded"] } }, { $set: { status: "failed", failure_reason: String(paystackData.gateway_response ?? status).slice(0, 300) } }, { new: true });
    if (changed) await writeAuditEvent({ eventKey: `provider-payment:${attempt._id}:status:failed`, actorRole: "system", action: "provider_payment_status_changed", resourceType: "provider_payment_attempt", resourceId: attempt._id, priorState: attempt.status, newState: "failed", correlationId: attempt.reference });
    if (attempt.purpose === "initial") await ProviderSubscription.updateOne({ _id: attempt.provider_subscription, status: "pending_payment" }, { $set: { status: "payment_failed" } });
    else await recordRenewalFailure(attempt, now);
    return { subscription: await serializeWithLatestAttempt(await ProviderSubscription.findById(attempt.provider_subscription)), payment_status: "failed" };
  }
  return { subscription: await serializeWithLatestAttempt(await ProviderSubscription.findById(attempt.provider_subscription)), payment_status: "pending" };
};

const recordRenewalFailure = async (attempt, now = new Date()) => {
  const subscription = await ProviderSubscription.findById(attempt.provider_subscription);
  if (!subscription || subscription.status !== "active") return;
  const retryDue = getProviderRenewalRetryAt(subscription.ends_at, attempt.attempt_number);
  subscription.renewal_attempts = Math.max(subscription.renewal_attempts ?? 0, attempt.attempt_number);
  subscription.next_renewal_attempt_at = subscription.auto_renew && retryDue && retryDue < subscription.renewal_grace_ends_at ? retryDue : null;
  subscription.renewal_lock_until = null;
  await subscription.save();
};

export const verifyMyProviderSubscriptionPayment = async (userId, subscriptionId, reference) => {
  const { profile } = await getPatientContext(userId);
  const attempt = await ProviderPaymentAttempt.findOne({ reference, provider_subscription: subscriptionId, patient_profile: profile._id });
  if (!attempt) throw new AppError("Payment reference not found for this subscription", 404);
  if (attempt.status === "success") return { subscription: await serializeWithLatestAttempt(await ProviderSubscription.findById(subscriptionId)), payment_status: "success" };
  if (attempt.status === "reversed" || attempt.status === "refunded") return { subscription: await serializeWithLatestAttempt(await ProviderSubscription.findById(subscriptionId)), payment_status: attempt.status };
  const paystackData = await verifyPaystackTransaction(reference);
  return fulfillVerifiedPayment(reference, paystackData);
};

export const enqueuePaystackWebhook = async (rawBody, signature, body) => {
  if (!verifyPaystackWebhookSignature(rawBody, signature)) throw new AppError("Invalid Paystack webhook signature", 401);
  const eventType = typeof body?.event === "string" ? body.event : "unknown";
  const transaction = body?.data?.transaction;
  const reference = typeof body?.data?.reference === "string"
    ? body.data.reference
    : typeof transaction?.reference === "string" ? transaction.reference : null;
  const gatewayTransactionId = transaction && typeof transaction === "object"
    ? transaction.id == null ? null : String(transaction.id)
    : transaction == null
      ? (eventType === "charge.success" && body?.data?.id != null ? String(body.data.id) : null)
      : String(transaction);
  const eventId = body?.data?.id == null ? "" : String(body.data.id);
  const eventKey = createHash("sha256").update(`${eventType}:${reference ?? ""}:${gatewayTransactionId ?? ""}:${eventId}:${rawBody.toString("base64")}`).digest("hex");
  let event;
  try {
    [event] = await PaystackWebhookEvent.create([{ event_key: eventKey, event_type: eventType, reference, gateway_transaction_id: gatewayTransactionId, status: reference || gatewayTransactionId ? "pending" : "ignored" }]);
  } catch (error) {
    if (error.code !== 11000) throw error;
    event = await PaystackWebhookEvent.findOne({ event_key: eventKey });
  }
  if (reference && event?.status !== "processed") {
    await writeAuditEvent({ eventKey: `paystack-webhook:${eventKey}`, actorRole: "system", action: "paystack_webhook_received", resourceType: "paystack_webhook_event", correlationId: reference, metadata: { event_type: eventType } });
    if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(eventType)) {
      const { processPaystackTransferWebhook } = await import("./provider-payout.service.js");
      const handled = await processPaystackTransferWebhook(eventType, body?.data);
      event.status = handled ? "processed" : "ignored";
      event.processed_at = new Date();
      await event.save();
    }
  }
};

export const processPendingPaystackWebhooks = async (limit = 100) => {
  let processed = 0;
  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const event = await PaystackWebhookEvent.findOneAndUpdate(
      { $or: [{ status: "pending", available_at: { $lte: now } }, { status: "processing", lock_expires_at: { $lte: now } }] },
      { $set: { status: "processing", lock_expires_at: addDays(now, 1 / 1440) }, $inc: { attempts: 1 } },
      { new: true, sort: { received_at: 1 } }
    );
    if (!event) break;
    try {
      const recognized = ["charge.success", "refund.processed", "charge.dispute.create"].includes(event.event_type);
      const reference = recognized ? await resolveWebhookReference(event) : null;
      if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(event.event_type) && reference) {
        const { verifyPaystackTransfer } = await import("./paystack.service.js");
        const { processPaystackTransferWebhook } = await import("./provider-payout.service.js");
        const transfer = await verifyPaystackTransfer(reference);
        const verifiedEvent = { success: "transfer.success", failed: "transfer.failed", reversed: "transfer.reversed" }[transfer?.status];
        if (verifiedEvent) await processPaystackTransferWebhook(verifiedEvent, transfer);
        event.status = "processed";
      } else if (event.event_type === "charge.success" && reference) {
        const payment = await verifyPaystackTransaction(reference);
        await fulfillVerifiedPayment(reference, payment);
        event.status = "processed";
      } else if (["refund.processed", "charge.dispute.create"].includes(event.event_type) && reference) {
        await revokeSubscriptionForPayment(reference, event.event_type === "refund.processed" ? "refunded" : "reversed");
        event.status = "processed";
      } else {
        event.status = "ignored";
      }
      event.processed_at = new Date();
      event.last_error = null;
      event.lock_expires_at = null;
      await event.save();
      processed += 1;
    } catch (error) {
      event.status = "pending";
      event.lock_expires_at = null;
      event.available_at = addDays(new Date(), 30 / (24 * 60));
      event.last_error = String(error.message).slice(0, 300);
      await event.save();
    }
  }
  return processed;
};

const resolveWebhookReference = async (event) => {
  if (event.reference) return event.reference;
  if (!event.gateway_transaction_id) return null;
  const attempt = await ProviderPaymentAttempt.findOne({ gateway_transaction_id: event.gateway_transaction_id }).select("reference");
  if (attempt) return attempt.reference;
  const transaction = await getPaystackTransaction(event.gateway_transaction_id);
  return transaction?.reference ?? null;
};

const revokeSubscriptionForPayment = async (reference, reason) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const attempt = await ProviderPaymentAttempt.findOne({ reference }).session(session);
      if (!attempt || ["reversed", "refunded"].includes(attempt.status)) return;
      const previous = attempt.status;
      const now = new Date();
      attempt.status = reason;
      attempt.failure_reason = reason;
      await attempt.save({ session });
      if (previous === "success") await reverseProviderPaymentEarnings(attempt, reason, { session });
      await ProviderSubscription.updateOne(
        { _id: attempt.provider_subscription },
        { $set: { status: "revoked", auto_renew: false, renewal_grace_ends_at: null, next_renewal_attempt_at: null, renewal_lock_until: null, ends_at: now } },
        { session }
      );
      await writeAuditEvent({ eventKey: `provider-payment:${attempt._id}:status:${reason}`, actorRole: "system", action: "provider_payment_status_changed", resourceType: "provider_payment_attempt", resourceId: attempt._id, priorState: previous, newState: reason, correlationId: reference, session });
    });
  } finally { await session.endSession(); }
};

export const runDueProviderRenewals = async (limit = 100) => {
  const now = new Date();
  const pendingAttempts = await ProviderPaymentAttempt.find({
    purpose: "renewal",
    status: "pending",
    $or: [{ next_reconcile_at: null }, { next_reconcile_at: { $lte: now } }],
  }).sort({ createdAt: 1 }).limit(limit);
  for (const pendingAttempt of pendingAttempts) {
    try {
      const payment = await verifyPaystackTransaction(pendingAttempt.reference);
      await fulfillVerifiedPayment(pendingAttempt.reference, payment);
    } catch (error) {
      if (error.statusCode === 404 && pendingAttempt.purpose === "renewal") {
        // A missing verification result after an ambiguous charge is not proof that
        // Paystack did not process it. Keep the same reference and reconcile later.
        pendingAttempt.next_reconcile_at = addDays(now, 5 / (24 * 60));
        pendingAttempt.failure_reason = "Paystack has not exposed this transaction yet; awaiting safe reconciliation";
        await pendingAttempt.save();
      }
      // An uncertain result stays tied to the same reference; do not make a second charge.
    }
  }
  const stillPendingSubscriptions = new Set(
    (await ProviderPaymentAttempt.find({ purpose: "renewal", status: "pending" }).select("provider_subscription").limit(limit))
      .map((attempt) => attempt.provider_subscription.toString())
  );
  const due = await ProviderSubscription.find({
    status: "active",
    auto_renew: true,
    ends_at: { $lte: now },
    renewal_grace_ends_at: { $gt: now },
    next_renewal_attempt_at: { $lte: now },
    renewal_attempts: { $lt: env.providerRenewalMaxAttempts },
    $or: [{ renewal_lock_until: null }, { renewal_lock_until: { $lte: now } }],
  }).limit(limit);
  let started = 0;
  for (const candidate of due) {
    if (stillPendingSubscriptions.has(candidate._id.toString())) continue;
    const attemptNumber = (candidate.renewal_attempts || 0) + 1;
    const claimed = await ProviderSubscription.findOneAndUpdate(
      { _id: candidate._id, status: "active", auto_renew: true, renewal_attempts: candidate.renewal_attempts, next_renewal_attempt_at: { $lte: now }, $or: [{ renewal_lock_until: null }, { renewal_lock_until: { $lte: now } }] },
      { $set: { renewal_lock_until: addDays(now, 1 / 1440) }, $inc: { renewal_attempts: 1 } },
      { new: true }
    );
    if (!claimed) continue;

    const existingAttempt = await ProviderPaymentAttempt.findOne({ provider_subscription: claimed._id, purpose: "renewal", attempt_number: attemptNumber });
    if (existingAttempt) continue;

    const authorization = await PaymentAuthorization.findOne({ _id: claimed.payment_authorization, patient_profile: claimed.patient_profile, active: true, reusable: true })
      .select("+authorization_code_encrypted +authorization_iv +authorization_tag");
    if (!authorization) {
      await ProviderSubscription.updateOne(
        { _id: claimed._id, auto_renew: true },
        { $set: { auto_renew: false, renewal_lock_until: null, next_renewal_attempt_at: null } }
      );
      continue;
    }
    const stillEnabled = await ProviderSubscription.exists({ _id: claimed._id, status: "active", auto_renew: true });
    if (!stillEnabled) {
      await ProviderSubscription.updateOne({ _id: claimed._id }, { $set: { renewal_lock_until: null } });
      continue;
    }
    const amountKobo = Math.round(claimed.service_snapshot.discounted_price * 100);
    const globalSystem = await System.findOne({ key: "global" }).select("platform_fee_percent").lean();
    const commissionRate = Number(globalSystem?.platform_fee_percent ?? 15);
    const earningsSplit = calculateProviderPaymentSplit(amountKobo, commissionRate);
    const reference = newReference();
    const attempt = await ProviderPaymentAttempt.create({
      provider_subscription: claimed._id,
      provider_service: claimed.provider_service,
      provider_profile: claimed.provider_profile,
      patient_profile: claimed.patient_profile,
      purpose: "renewal",
      status: "pending",
      reference,
      amount_kobo: amountKobo,
      commission_rate_percent: commissionRate,
      platform_fee_kobo: earningsSplit.platformFeeKobo,
      provider_net_kobo: earningsSplit.providerNetKobo,
      commission_snapshotted_at: new Date(),
      commission_snapshot_source: "checkout_initialization",
      currency: claimed.service_snapshot.currency,
      billing_email: authorization.billing_email,
      attempt_number: attemptNumber,
    });
    await writeAuditEvent({ eventKey: `provider-payment:${attempt._id}:status:pending`, actorRole: "system", action: "provider_payment_status_changed", resourceType: "provider_payment_attempt", resourceId: attempt._id, newState: "pending", correlationId: attempt.reference, metadata: { purpose: "renewal", amount_kobo: amountKobo } });
    try {
      const authorizationCode = decryptPaymentToken({
        ciphertext: authorization.authorization_code_encrypted,
        iv: authorization.authorization_iv,
        tag: authorization.authorization_tag,
      });
      const charge = await chargePaystackAuthorization({
        email: authorization.billing_email,
        authorizationCode,
        amountKobo,
        reference,
        metadata: {
          purpose: "provider_service_subscription_renewal",
          payment_attempt_id: attempt._id.toString(),
          provider_subscription_id: claimed._id.toString(),
          provider_service_id: claimed.provider_service.toString(),
          patient_profile_id: claimed.patient_profile.toString(),
        },
      });
      if (charge.status === "success") {
        const verified = await verifyPaystackTransaction(reference);
        await fulfillVerifiedPayment(reference, verified);
      } else if (["failed", "abandoned"].includes(charge.status)) {
        const previousStatus = attempt.status;
        attempt.status = "failed";
        attempt.failure_reason = String(charge.gateway_response ?? charge.status).slice(0, 300);
        await attempt.save();
        await writeAuditEvent({ eventKey: `provider-payment:${attempt._id}:status:failed`, actorRole: "system", action: "provider_payment_status_changed", resourceType: "provider_payment_attempt", resourceId: attempt._id, priorState: previousStatus, newState: "failed", correlationId: attempt.reference });
        await recordRenewalFailure(attempt, now);
      }
    } catch (error) {
      // The charge may have reached Paystack despite a timeout. Keep this reference pending
      // and reconcile it before any later attempt to prevent a duplicate charge.
      attempt.status = "pending";
      attempt.next_reconcile_at = addDays(new Date(), 5 / (24 * 60));
      attempt.failure_reason = String(error.message).slice(0, 300);
      await attempt.save();
    } finally {
      await ProviderSubscription.updateOne({ _id: claimed._id }, { $set: { renewal_lock_until: null } });
    }
    started += 1;
  }
  await expireProviderSubscriptions(new Date());
  return started;
};

export const expireProviderSubscriptions = async (now = new Date()) => {
  await ProviderSubscription.updateMany(
    {
      status: "active",
      ends_at: { $lte: now },
      $or: [{ renewal_grace_ends_at: null }, { renewal_grace_ends_at: { $lte: now } }],
    },
    { $set: { status: "expired", auto_renew: false, next_renewal_attempt_at: null, renewal_lock_until: null } }
  );
};
