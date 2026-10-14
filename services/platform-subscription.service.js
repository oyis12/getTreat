import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import PatientProfile from "../models/patient-profile.model.js";
import PlatformSubscription from "../models/platform-subscription.model.js";
import PlatformPaymentAttempt from "../models/platform-payment-attempt.model.js";
import PaymentAuthorization from "../models/payment-authorization.model.js";
import System from "../models/system.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import { env } from "../config/env.js";
import { assertPaymentTokenEncryptionConfigured, encryptPaymentToken, decryptPaymentToken, hashPaymentSignature } from "../utils/payment-token-crypto.js";
import { initializePaystackCheckout, verifyPaystackTransaction, chargePaystackAuthorization, verifyPaystackWebhookSignature } from "./paystack.service.js";
import { writeAuditEvent } from "./financial-ledger.service.js";

const addDays = (date, days) => new Date(new Date(date).getTime() + days * 86400000);
const reference = () => `gt4o${randomBytes(18).toString("hex")}`;
export const addPlatformBillingCycle = (date, cycle) => {
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[cycle];
  if (!months) throw new AppError("Unsupported platform billing cycle", 400);
  const result = new Date(date); const day = result.getUTCDate(); result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  result.setUTCDate(Math.min(day, new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()));
  return result;
};
const getContext = async (userId) => {
  const user = await User.findById(userId).select("email role emailVerified accountStatus");
  if (!user || user.role !== "patient" || !user.emailVerified || user.accountStatus !== "active") throw new AppError("An active verified patient account is required", 403);
  const profile = await PatientProfile.findOne({ user: user._id }).select("_id user");
  if (!profile) throw new AppError("Patient profile not found", 404);
  return { user, profile };
};
const serialize = (doc, attempt) => ({
  id: doc._id.toString(), patient_profile_id: doc.patient_profile.toString(), plan: doc.plan_snapshot,
  status: doc.status, starts_at: doc.starts_at, ends_at: doc.ends_at, auto_renew: doc.auto_renew,
  auto_renew_consent_at: doc.auto_renew_consent_at, auto_renew_disabled_at: doc.auto_renew_disabled_at,
  renewal_grace_ends_at: doc.renewal_grace_ends_at, renewal_attempts: doc.renewal_attempts,
  latest_payment: attempt ? { reference: attempt.reference, status: attempt.status, amount: Number((attempt.amount_kobo / 100).toFixed(2)), currency: attempt.currency, authorization_url: attempt.authorization_url, created_at: attempt.createdAt } : null,
  created_at: doc.createdAt, modified_at: doc.modifiedAt,
});
const latestAttempt = (subscriptionId) => PlatformPaymentAttempt.findOne({ platform_subscription: subscriptionId }).sort({ createdAt: -1 });
const serializeWithAttempt = async (doc) => serialize(doc, await latestAttempt(doc._id));
const assertPaymentMatches = (attempt, data) => {
  const metadata = typeof data.metadata === "string" ? JSON.parse(data.metadata || "{}") : data.metadata ?? {};
  if (data.reference !== attempt.reference || Number(data.amount) !== attempt.amount_kobo || data.currency !== attempt.currency || data.customer?.email?.toLowerCase?.() !== attempt.billing_email.toLowerCase() || metadata.platform_payment_attempt_id !== attempt._id.toString() || metadata.platform_subscription_id !== attempt.platform_subscription.toString()) throw new AppError("Paystack payment does not match the expected platform subscription", 409);
};
const saveAuthorization = async (attempt, data, session) => {
  if (!attempt.requested_auto_renew) return null;
  const auth = data.authorization;
  if (!auth?.reusable || !auth.authorization_code || !auth.signature) return null;
  const encrypted = encryptPaymentToken(auth.authorization_code);
  return PaymentAuthorization.findOneAndUpdate({ patient_profile: attempt.patient_profile, signature_hash: hashPaymentSignature(auth.signature) }, { $setOnInsert: {
    patient_profile: attempt.patient_profile, billing_email: attempt.billing_email, paystack_customer_code: data.customer?.customer_code ?? null,
    authorization_code_encrypted: encrypted.ciphertext, authorization_iv: encrypted.iv, authorization_tag: encrypted.tag,
    signature_hash: hashPaymentSignature(auth.signature), reusable: true, active: true, channel: auth.channel ?? null,
  } }, { upsert: true, new: true, session, setDefaultsOnInsert: true });
};

export const startPlatformSubscription = async (userId, billingCycle, autoRenew, idempotencyKey) => {
  const { user, profile } = await getContext(userId);
  const existing = await PlatformPaymentAttempt.findOne({ patient_profile: profile._id, idempotency_key: idempotencyKey });
  if (existing) {
    const sub = await PlatformSubscription.findById(existing.platform_subscription);
    if (!sub || sub.plan_snapshot.billing_cycle !== billingCycle || existing.requested_auto_renew !== autoRenew) throw new AppError("Idempotency-Key was already used for a different request", 409);
    return { reused: true, subscription: { ...(await serializeWithAttempt(sub)), payment: { reference: existing.reference, status: existing.status, authorization_url: existing.authorization_url, access_code: existing.access_code } } };
  }
  if (autoRenew) assertPaymentTokenEncryptionConfigured();
  const system = await System.findOne({ key: "global" }).select("platform_subscription").lean();
  if (!system?.platform_subscription?.enabled) throw new AppError("Platform subscriptions are temporarily unavailable", 503);
  const plan = system.platform_subscription.plans?.find((item) => item.billing_cycle === billingCycle && item.active);
  if (!plan) throw new AppError("Selected platform plan is unavailable", 404);
  const unfinished = await PlatformSubscription.findOne({ patient_profile: profile._id, status: { $in: ["pending_payment", "active"] } });
  if (unfinished) throw new AppError(unfinished.status === "active" ? "An active platform subscription already exists" : "Complete the pending platform subscription checkout first", 409);
  const amountKobo = Math.round(Number(plan.amount) * 100);
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 1) throw new AppError("Platform subscription price is invalid for Paystack", 422);
  const ref = reference(); let sub; let attempt;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      [sub] = await PlatformSubscription.create([{ patient_profile: profile._id, plan_snapshot: { billing_cycle: billingCycle, amount: plan.amount, currency: plan.currency ?? "NGN" }, status: "pending_payment", auto_renew: autoRenew, auto_renew_consent_at: autoRenew ? new Date() : null }], { session });
      [attempt] = await PlatformPaymentAttempt.create([{ platform_subscription: sub._id, patient_profile: profile._id, purpose: "initial", status: "initializing", reference: ref, idempotency_key: idempotencyKey, requested_auto_renew: autoRenew, amount_kobo: amountKobo, billing_email: user.email }], { session });
      await writeAuditEvent({ eventKey: `platform-payment:${attempt._id}:initializing`, actor: user._id, actorRole: "patient", action: "platform_payment_status_changed", resourceType: "platform_payment_attempt", resourceId: attempt._id, newState: "initializing", correlationId: ref, metadata: { amount_kobo: amountKobo, billing_cycle: billingCycle }, session });
    });
  } catch (error) {
    if (error.code === 11000) {
      const racedAttempt = await PlatformPaymentAttempt.findOne({ patient_profile: profile._id, idempotency_key: idempotencyKey });
      if (racedAttempt) {
        const racedSubscription = await PlatformSubscription.findById(racedAttempt.platform_subscription);
        if (racedSubscription?.plan_snapshot.billing_cycle === billingCycle && racedAttempt.requested_auto_renew === autoRenew) {
          return { reused: true, subscription: { ...(await serializeWithAttempt(racedSubscription)), payment: { reference: racedAttempt.reference, status: racedAttempt.status, authorization_url: racedAttempt.authorization_url, access_code: racedAttempt.access_code } } };
        }
        throw new AppError("Idempotency-Key was already used for a different request", 409);
      }
      throw new AppError("An active or pending platform subscription already exists", 409);
    }
    throw error;
  }
  finally { await session.endSession(); }
  try {
    const checkout = await initializePaystackCheckout({ email: user.email, amountKobo, reference: ref, recurring: autoRenew, metadata: { purpose: "getreat_platform_subscription", platform_payment_attempt_id: attempt._id.toString(), platform_subscription_id: sub._id.toString(), patient_profile_id: profile._id.toString(), billing_cycle: billingCycle, auto_renew: autoRenew } });
    if (checkout.reference !== ref || !checkout.authorization_url) throw new AppError("Paystack returned an invalid checkout response", 502);
    attempt.status = "pending"; attempt.authorization_url = checkout.authorization_url; attempt.access_code = checkout.access_code ?? null; await attempt.save();
  } catch (error) {
    attempt.status = "failed"; attempt.failure_reason = String(error.message).slice(0, 300); await attempt.save();
    sub.status = "payment_failed"; await sub.save();
    await writeAuditEvent({ eventKey: `platform-payment:${attempt._id}:failed`, actorRole: "system", action: "platform_payment_status_changed", resourceType: "platform_payment_attempt", resourceId: attempt._id, priorState: "initializing", newState: "failed", correlationId: ref });
    throw error;
  }
  return { reused: false, subscription: { ...(await serializeWithAttempt(sub)), payment: { reference: attempt.reference, status: attempt.status, authorization_url: attempt.authorization_url, access_code: attempt.access_code } } };
};

export const getMyPlatformSubscription = async (userId) => {
  const { profile } = await getContext(userId);
  const items = await PlatformSubscription.find({ patient_profile: profile._id }).sort({ createdAt: -1 }).limit(20);
  return { current: items.find((item) => item.status === "active" && (item.ends_at > new Date() || (item.renewal_grace_ends_at > new Date()))) ? await serializeWithAttempt(items.find((item) => item.status === "active" && (item.ends_at > new Date() || item.renewal_grace_ends_at > new Date()))) : null, items: await Promise.all(items.map(serializeWithAttempt)) };
};
export const verifyMyPlatformSubscriptionPayment = async (userId, subscriptionId, ref) => {
  const { profile } = await getContext(userId);
  const attempt = await PlatformPaymentAttempt.findOne({ platform_subscription: subscriptionId, patient_profile: profile._id, reference: ref });
  if (!attempt) throw new AppError("Payment reference not found for this platform subscription", 404);
  if (["success", "reversed", "refunded"].includes(attempt.status)) return { subscription: await serializeWithAttempt(await PlatformSubscription.findById(subscriptionId)), payment_status: attempt.status };
  const data = await verifyPaystackTransaction(ref);
  await fulfillPlatformPayment(ref, data);
  const updated = await PlatformPaymentAttempt.findOne({ reference: ref });
  return { subscription: await serializeWithAttempt(await PlatformSubscription.findById(subscriptionId)), payment_status: updated?.status ?? "pending" };
};

export const fulfillPlatformPayment = async (ref, data) => {
  const initial = await PlatformPaymentAttempt.findOne({ reference: ref });
  if (!initial) return false;
  if (data.status !== "success") { await settlePlatformNonSuccess(initial, data); return true; }
  assertPaymentMatches(initial, data);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const attempt = await PlatformPaymentAttempt.findById(initial._id).session(session);
    if (!attempt || ["success", "reversed", "refunded"].includes(attempt.status)) return;
    const sub = await PlatformSubscription.findById(attempt.platform_subscription).session(session);
    if (!sub) throw new AppError("Platform subscription not found", 404);
    const authorization = await saveAuthorization(attempt, data, session);
    const now = new Date(); const start = attempt.purpose === "renewal" && sub.ends_at ? new Date(sub.ends_at) : now;
    sub.status = "active"; if (attempt.purpose === "initial") sub.starts_at = start;
    sub.ends_at = addPlatformBillingCycle(start, sub.plan_snapshot.billing_cycle);
    sub.payment_authorization = authorization?._id ?? sub.payment_authorization;
    if (attempt.purpose === "initial" && sub.auto_renew && !authorization) sub.auto_renew = false;
    sub.renewal_attempts = 0; sub.renewal_grace_ends_at = sub.auto_renew ? addDays(sub.ends_at, env.providerRenewalGraceDays) : null;
    sub.next_renewal_attempt_at = sub.auto_renew ? sub.ends_at : null; sub.renewal_lock_until = null; await sub.save({ session });
    const previous = attempt.status; attempt.status = "success"; attempt.gateway_transaction_id = data.id == null ? null : String(data.id); attempt.verified_at = now; attempt.failure_reason = null; await attempt.save({ session });
    await writeAuditEvent({ eventKey: `platform-payment:${attempt._id}:success`, actorRole: "system", action: "platform_payment_status_changed", resourceType: "platform_payment_attempt", resourceId: attempt._id, priorState: previous, newState: "success", correlationId: ref, metadata: { gateway_transaction_id: attempt.gateway_transaction_id }, session });
  }); } finally { await session.endSession(); }
  return true;
};
const settlePlatformNonSuccess = async (attempt, data) => {
  if (["pending", "processing", "ongoing", "queued"].includes(data.status)) return;
  if (data.status === "reversed") {
    const changed = await PlatformPaymentAttempt.findOneAndUpdate({ _id: attempt._id, status: { $nin: ["success", "reversed", "refunded"] } }, { $set: { status: "reversed", failure_reason: "Paystack reversed the renewal charge" } }, { new: true });
    if (changed) await writeAuditEvent({ eventKey: `platform-payment:${attempt._id}:reversed`, actorRole: "system", action: "platform_payment_status_changed", resourceType: "platform_payment_attempt", resourceId: attempt._id, priorState: attempt.status, newState: "reversed", correlationId: attempt.reference });
    return;
  }
  if (["failed", "abandoned"].includes(data.status)) {
    const changed = await PlatformPaymentAttempt.findOneAndUpdate({ _id: attempt._id, status: { $nin: ["success", "reversed", "refunded"] } }, { $set: { status: "failed", failure_reason: String(data.gateway_response ?? data.status).slice(0, 300) } }, { new: true });
    if (changed) { await PlatformSubscription.updateOne({ _id: attempt.platform_subscription, status: "pending_payment" }, { $set: { status: "payment_failed" } }); await writeAuditEvent({ eventKey: `platform-payment:${attempt._id}:failed`, actorRole: "system", action: "platform_payment_status_changed", resourceType: "platform_payment_attempt", resourceId: attempt._id, priorState: attempt.status, newState: "failed", correlationId: attempt.reference }); }
  }
};
export const processPlatformWebhook = async (eventType, ref) => {
  const attempt = await PlatformPaymentAttempt.findOne({ reference: ref }); if (!attempt) return false;
  if (eventType === "charge.success") return fulfillPlatformPayment(ref, await verifyPaystackTransaction(ref));
  if (["refund.processed", "charge.dispute.create"].includes(eventType)) {
    const status = eventType === "refund.processed" ? "refunded" : "reversed";
    const session = await mongoose.startSession(); try { await session.withTransaction(async () => {
      const current = await PlatformPaymentAttempt.findOne({ reference: ref }).session(session);
      if (!current || ["reversed", "refunded"].includes(current.status)) return;
      const prior = current.status; current.status = status; await current.save({ session });
      await PlatformSubscription.updateOne({ _id: current.platform_subscription }, { $set: { status: "revoked", auto_renew: false, next_renewal_attempt_at: null, renewal_lock_until: null, ends_at: new Date() } }, { session });
      await writeAuditEvent({ eventKey: `platform-payment:${current._id}:${status}`, actorRole: "system", action: "platform_payment_status_changed", resourceType: "platform_payment_attempt", resourceId: current._id, priorState: prior, newState: status, correlationId: ref, session });
    }); } finally { await session.endSession(); } return true;
  }
  if (eventType === "refund.failed") return true;
  return false;
};
export const verifyPlatformWebhookSignature = (rawBody, signature) => verifyPaystackWebhookSignature(rawBody, signature);
export const setPlatformAutoRenew = async (userId, subscriptionId, enabled) => {
  const { profile } = await getContext(userId);
  const sub = await PlatformSubscription.findOne({ _id: subscriptionId, patient_profile: profile._id });
  if (!sub) throw new AppError("Platform subscription not found", 404);
  if (sub.status !== "active") throw new AppError("Auto-renew can only be changed on an active subscription", 409);
  if (enabled) {
    const authorization = sub.payment_authorization
      ? await PaymentAuthorization.findOne({ _id: sub.payment_authorization, patient_profile: profile._id, active: true, reusable: true })
      : null;
    if (!authorization) throw new AppError("Complete a Paystack checkout with auto-renew enabled before turning on automatic renewal", 409);
    sub.auto_renew = true; sub.payment_authorization = authorization._id; sub.auto_renew_consent_at = new Date(); sub.auto_renew_disabled_at = null; sub.renewal_attempts = 0; sub.renewal_grace_ends_at = addDays(sub.ends_at, env.providerRenewalGraceDays); sub.next_renewal_attempt_at = sub.ends_at;
  } else { sub.auto_renew = false; sub.auto_renew_disabled_at = new Date(); sub.next_renewal_attempt_at = null; sub.renewal_grace_ends_at = null; sub.renewal_lock_until = null; }
  await sub.save();
  await writeAuditEvent({ eventKey: `platform-subscription:${sub._id}:auto-renew:${sub.auto_renew ? "enabled" : "disabled"}:${sub.modifiedAt?.getTime?.() ?? Date.now()}`, actor: userId, actorRole: "patient", action: "platform_subscription_auto_renew_changed", resourceType: "platform_subscription", resourceId: sub._id, newState: sub.auto_renew ? "enabled" : "disabled" });
  return serializeWithAttempt(sub);
};

export const hasActivePlatformSubscription = async (userId, now = new Date()) => {
  const profile = await PatientProfile.findOne({ user: userId }).select("_id").lean(); if (!profile) return false;
  return Boolean(await PlatformSubscription.exists({ patient_profile: profile._id, status: "active", $or: [{ ends_at: { $gt: now } }, { renewal_grace_ends_at: { $gt: now } }] }));
};

export const runDuePlatformRenewals = async (limit = 1) => {
  await reconcilePlatformPayments(limit);
  let started = 0;
  for (let i = 0; i < limit; i += 1) {
    const now = new Date();
    const sub = await PlatformSubscription.findOneAndUpdate({ status: "active", auto_renew: true, next_renewal_attempt_at: { $lte: now }, renewal_lock_until: { $lte: now } }, { $set: { renewal_lock_until: addDays(now, 5 / 1440) } }, { new: true });
    if (!sub) break;
    const attemptNo = (sub.renewal_attempts ?? 0) + 1;
    const auth = await PaymentAuthorization.findOne({ _id: sub.payment_authorization, active: true, reusable: true }).select("+authorization_code_encrypted +authorization_iv +authorization_tag");
    if (!auth) {
      sub.auto_renew = false; sub.next_renewal_attempt_at = null; sub.renewal_grace_ends_at = null; sub.renewal_lock_until = null;
      if (sub.ends_at <= now) sub.status = "expired";
      await sub.save(); continue;
    }
    if (attemptNo > 3) { sub.next_renewal_attempt_at = null; sub.renewal_lock_until = null; if (now >= (sub.renewal_grace_ends_at ?? addDays(sub.ends_at, env.providerRenewalGraceDays))) { sub.status = "expired"; sub.auto_renew = false; } await sub.save(); continue; }
    const ref = reference(); const amountKobo = Math.round(sub.plan_snapshot.amount * 100);
    const attempt = await PlatformPaymentAttempt.create({ platform_subscription: sub._id, patient_profile: sub.patient_profile, purpose: "renewal", status: "pending", reference: ref, amount_kobo: amountKobo, billing_email: auth.billing_email, attempt_number: attemptNo });
    sub.renewal_attempts = attemptNo; await sub.save();
    let needsReconciliation = false;
    try {
      const charge = await chargePaystackAuthorization({ email: auth.billing_email, authorizationCode: decryptPaymentToken({ ciphertext: auth.authorization_code_encrypted, iv: auth.authorization_iv, tag: auth.authorization_tag }), amountKobo, reference: ref, metadata: { purpose: "getreat_platform_subscription_renewal", platform_payment_attempt_id: attempt._id.toString(), platform_subscription_id: sub._id.toString(), patient_profile_id: sub.patient_profile.toString() } });
      if (charge.status === "success") await fulfillPlatformPayment(ref, await verifyPaystackTransaction(ref));
      else if (["failed", "abandoned"].includes(charge.status)) await settlePlatformNonSuccess(attempt, charge);
      else needsReconciliation = true;
    } catch (error) { needsReconciliation = true; attempt.next_reconcile_at = addDays(new Date(), 5 / 1440); attempt.failure_reason = String(error.message).slice(0, 300); await attempt.save(); }
    finally {
      const latest = await PlatformSubscription.findById(sub._id);
      if (latest) {
        const graceEnd = latest.renewal_grace_ends_at ?? addDays(latest.ends_at, env.providerRenewalGraceDays);
        if (latest.ends_at > sub.ends_at) { latest.renewal_lock_until = null; }
        else if (needsReconciliation) { latest.next_renewal_attempt_at = null; latest.renewal_lock_until = null; }
        else {
          const retryAt = attemptNo < 3 ? addDays(sub.ends_at, [0, 3, 6][attemptNo]) : null;
          latest.next_renewal_attempt_at = retryAt && retryAt < graceEnd ? retryAt : null;
          latest.renewal_lock_until = null;
          if (!latest.next_renewal_attempt_at && new Date() >= graceEnd) { latest.status = "expired"; latest.auto_renew = false; }
        }
        await latest.save();
      }
    }
    started += 1;
  }
  await PlatformSubscription.updateMany({ status: "active", ends_at: { $lte: new Date() }, $or: [{ auto_renew: false }, { renewal_grace_ends_at: { $lte: new Date() } }] }, { $set: { status: "expired", auto_renew: false, next_renewal_attempt_at: null, renewal_lock_until: null } });
  return started;
};

const reconcilePlatformPayments = async (limit) => {
  const pending = await PlatformPaymentAttempt.find({ status: "pending", purpose: "renewal", next_reconcile_at: { $lte: new Date() } }).sort({ next_reconcile_at: 1 }).limit(limit);
  for (const attempt of pending) {
    try {
      const data = await verifyPaystackTransaction(attempt.reference);
      if (data.status === "success") await fulfillPlatformPayment(attempt.reference, data);
      else if (["failed", "abandoned", "reversed"].includes(data.status)) {
        await settlePlatformNonSuccess(attempt, data);
        const sub = await PlatformSubscription.findById(attempt.platform_subscription);
        if (sub?.status === "active" && sub.auto_renew) {
          const graceEnd = sub.renewal_grace_ends_at ?? addDays(sub.ends_at, env.providerRenewalGraceDays);
          const retryAt = attempt.attempt_number < 3 ? addDays(sub.ends_at, [0, 3, 6][attempt.attempt_number]) : null;
          sub.next_renewal_attempt_at = retryAt && retryAt < graceEnd ? retryAt : null;
          if (!sub.next_renewal_attempt_at && new Date() >= graceEnd) { sub.status = "expired"; sub.auto_renew = false; }
          await sub.save();
        }
      } else {
        attempt.next_reconcile_at = addDays(new Date(), 5 / 1440); await attempt.save();
      }
    } catch (error) {
      attempt.next_reconcile_at = addDays(new Date(), 5 / 1440); attempt.failure_reason = String(error.message).slice(0, 300); await attempt.save();
    }
  }
};
