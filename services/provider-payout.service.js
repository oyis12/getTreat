import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import AuditLog from "../models/audit-log.model.js";
import ProviderBalance from "../models/provider-balance.model.js";
import ProviderLedgerEntry from "../models/provider-ledger-entry.model.js";
import ProviderPayout from "../models/provider-payout.model.js";
import ProviderPayoutMethod from "../models/provider-payout-method.model.js";
import ProviderProfile from "../models/provider-profile.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import { env } from "../config/env.js";
import {
  createPaystackTransferRecipient,
  finalizePaystackTransfer,
  initiatePaystackTransfer,
  listPaystackBanks,
  resolvePaystackBankAccount,
  verifyPaystackTransfer,
} from "./paystack.service.js";
import { writeAuditEvent } from "./financial-ledger.service.js";

const newTransferReference = () => `gtpo${randomBytes(18).toString("hex")}`;
const major = (kobo) => Number((kobo / 100).toFixed(2));
const lowerName = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const getProviderProfile = async (userId) => {
  const profile = await ProviderProfile.findOne({ user: userId }).select("_id user");
  if (!profile) throw new AppError("Provider profile not found", 404);
  return profile;
};

const serializeMethod = (method) => ({
  id: method._id.toString(),
  bank_code: method.bank_code,
  bank_name: method.bank_name,
  account_name: method.account_name,
  account_number_last4: method.account_last4,
  is_default: method.is_default,
  active: method.active,
  created_at: method.createdAt,
  modified_at: method.modifiedAt,
});

const serializePayout = (payout) => ({
  id: payout._id.toString(),
  amount: major(payout.amount_kobo),
  amount_minor: payout.amount_kobo,
  currency: payout.currency,
  status: payout.status,
  payout_method: payout.payout_method && typeof payout.payout_method === "object" ? serializeMethod(payout.payout_method) : { id: payout.payout_method?.toString?.() ?? payout.payout_method },
  transfer: payout.transfer_attempts?.length ? {
    reference: payout.transfer_attempts.at(-1).reference,
    status: payout.transfer_attempts.at(-1).status,
    created_at: payout.transfer_attempts.at(-1).created_at,
    modified_at: payout.transfer_attempts.at(-1).modified_at,
  } : null,
  reviewed_at: payout.reviewed_at,
  review_reason: payout.review_reason,
  paid_at: payout.paid_at,
  created_at: payout.createdAt,
  modified_at: payout.modifiedAt,
});

const toSafeBank = (bank) => ({ name: bank.name, code: bank.code, slug: bank.slug ?? null });

export const listBanks = async () => {
  const data = await listPaystackBanks();
  return (Array.isArray(data) ? data : []).map(toSafeBank);
};

export const resolvePayoutBankAccount = async ({ bankCode, accountNumber }) => {
  const account = await resolvePaystackBankAccount({ bankCode, accountNumber });
  if (!account?.account_name) throw new AppError("Paystack could not verify this bank account", 422);
  return { account_name: account.account_name, bank_code: bankCode };
};

export const listPayoutMethods = async (userId) => {
  const profile = await getProviderProfile(userId);
  const methods = await ProviderPayoutMethod.find({ provider_profile: profile._id, active: true }).sort({ is_default: -1, createdAt: -1 });
  return methods.map(serializeMethod);
};

export const createPayoutMethod = async (userId, { bank_code: bankCode, account_number: accountNumber, confirmed_account_name: confirmedName }) => {
  const profile = await getProviderProfile(userId);
  const user = await User.findById(userId).select("email fullname");
  if (!user) throw new AppError("Provider account not found", 404);
  const verified = await resolvePaystackBankAccount({ bankCode, accountNumber });
  if (!verified?.account_name) throw new AppError("Paystack could not verify this bank account", 422);
  if (lowerName(confirmedName) !== lowerName(verified.account_name)) throw new AppError("Confirm the account name returned by bank verification", 409);

  const recipient = await createPaystackTransferRecipient({ name: verified.account_name, accountNumber, bankCode, email: user.email });
  if (!recipient?.recipient_code) throw new AppError("Paystack did not return a transfer recipient", 502);
  const bankName = recipient.details?.bank_name || (await listPaystackBanks()).find((bank) => String(bank.code) === bankCode)?.name;
  if (!bankName) throw new AppError("Paystack did not identify the selected bank", 502);

  const session = await mongoose.startSession();
  let method;
  let reused = false;
  try {
    await session.withTransaction(async () => {
      const existing = await ProviderPayoutMethod.findOne({ provider_profile: profile._id, recipient_code: recipient.recipient_code, active: true }).select("+recipient_code").session(session);
      if (existing) {
        method = existing;
        reused = true;
        return;
      }
      const defaultExists = await ProviderPayoutMethod.exists({ provider_profile: profile._id, active: true, is_default: true }).session(session);
      if (!defaultExists) await ProviderPayoutMethod.updateMany({ provider_profile: profile._id, active: true }, { $set: { is_default: false } }, { session });
      [method] = await ProviderPayoutMethod.create([{
        provider_profile: profile._id,
        recipient_code: recipient.recipient_code,
        bank_code: verified.details?.bank_code ?? bankCode,
        bank_name: bankName,
        account_name: verified.account_name,
        account_last4: accountNumber.slice(-4),
        is_default: !defaultExists,
        active: true,
      }], { session });
      await writeAuditEvent({ actor: userId, actorRole: "provider", action: "payout_method_added", resourceType: "provider_payout_method", resourceId: method._id, newState: "active", metadata: { bank_code: method.bank_code, account_last4: method.account_last4 }, session });
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError("This payout method is already registered", 409);
    throw error;
  } finally { await session.endSession(); }
  return { method: serializeMethod(method), reused };
};

export const setDefaultPayoutMethod = async (userId, methodId) => {
  const profile = await getProviderProfile(userId);
  const method = await ProviderPayoutMethod.findOne({ _id: methodId, provider_profile: profile._id, active: true });
  if (!method) throw new AppError("Payout method not found", 404);
  if (method.is_default) return serializeMethod(method);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await ProviderPayoutMethod.updateMany({ provider_profile: profile._id, active: true }, { $set: { is_default: false } }, { session });
      method.is_default = true;
      await method.save({ session });
      await writeAuditEvent({ actor: userId, actorRole: "provider", action: "default_payout_method_changed", resourceType: "provider_payout_method", resourceId: method._id, newState: "default", metadata: { account_last4: method.account_last4 }, session });
    });
  } finally { await session.endSession(); }
  return serializeMethod(method);
};

export const deletePayoutMethod = async (userId, methodId) => {
  const profile = await getProviderProfile(userId);
  const method = await ProviderPayoutMethod.findOne({ _id: methodId, provider_profile: profile._id, active: true });
  if (!method) throw new AppError("Payout method not found", 404);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      method.active = false;
      method.is_default = false;
      await method.save({ session });
      const next = await ProviderPayoutMethod.findOne({ provider_profile: profile._id, active: true }).sort({ createdAt: -1 }).session(session);
      if (next) {
        next.is_default = true;
        await next.save({ session });
      }
      await writeAuditEvent({ actor: userId, actorRole: "provider", action: "payout_method_removed", resourceType: "provider_payout_method", resourceId: method._id, priorState: "active", newState: "inactive", metadata: { account_last4: method.account_last4 }, session });
    });
  } finally { await session.endSession(); }
  return { id: method._id.toString(), active: false };
};

export const getProviderEarnings = async (userId) => {
  const profile = await getProviderProfile(userId);
  const balance = await ProviderBalance.findOne({ provider_profile: profile._id }).lean();
  const [lifetime] = await ProviderLedgerEntry.aggregate([
    { $match: { provider_profile: profile._id, account: "provider", source_type: { $in: ["provider_payment", "appointment_payment", "refund", "reversal"] } } },
    { $group: { _id: null, net_earned_kobo: { $sum: "$amount_kobo" } } },
  ]);
  return {
    currency: "NGN",
    available: major(balance?.available_kobo ?? 0),
    available_minor: balance?.available_kobo ?? 0,
    reserved: major(balance?.reserved_kobo ?? 0),
    reserved_minor: balance?.reserved_kobo ?? 0,
    net_earned: major(lifetime?.net_earned_kobo ?? 0),
    net_earned_minor: lifetime?.net_earned_kobo ?? 0,
    recoverable: major(Math.max(0, -(balance?.available_kobo ?? 0))),
  };
};

const attachPayoutMethod = (query) => query.populate({ path: "payout_method", select: "bank_code bank_name account_name account_last4 is_default active createdAt modifiedAt" });

export const listProviderPayouts = async (userId, { page, limit, status = "all" }) => {
  const profile = await getProviderProfile(userId);
  const filter = { provider_profile: profile._id, ...(status === "all" ? {} : { status }) };
  const [items, total] = await Promise.all([
    attachPayoutMethod(ProviderPayout.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
    ProviderPayout.countDocuments(filter),
  ]);
  return { items: items.map(serializePayout), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getProviderPayout = async (userId, payoutId) => {
  const profile = await getProviderProfile(userId);
  const payout = await attachPayoutMethod(ProviderPayout.findOne({ _id: payoutId, provider_profile: profile._id }));
  if (!payout) throw new AppError("Payout request not found", 404);
  return serializePayout(payout);
};

export const requestProviderPayout = async (userId, { amountKobo, payoutMethodId, idempotencyKey }) => {
  const profile = await getProviderProfile(userId);
  const alreadyRequested = await ProviderPayout.findOne({ provider_profile: profile._id, idempotency_key: idempotencyKey });
  if (alreadyRequested) {
    if (alreadyRequested.amount_kobo !== amountKobo || (payoutMethodId && alreadyRequested.payout_method.toString() !== payoutMethodId.toString())) throw new AppError("Idempotency-Key was already used for a different payout request", 409);
    return { payout: serializePayout(await attachPayoutMethod(ProviderPayout.findById(alreadyRequested._id))), balance: await getProviderEarnings(userId), reused: true };
  }
  const methodFilter = { provider_profile: profile._id, active: true, ...(payoutMethodId ? { _id: payoutMethodId } : { is_default: true }) };
  const method = await ProviderPayoutMethod.findOne(methodFilter).select("+recipient_code");
  if (!method) throw new AppError("Choose an active payout method before requesting a withdrawal", 409);

  const session = await mongoose.startSession();
  let payout;
  let reused = false;
  try {
    await session.withTransaction(async () => {
      const existing = await ProviderPayout.findOne({ provider_profile: profile._id, idempotency_key: idempotencyKey }).session(session);
      if (existing) {
        if (existing.amount_kobo !== amountKobo || existing.payout_method.toString() !== method._id.toString()) throw new AppError("Idempotency-Key was already used for a different payout request", 409);
        payout = existing;
        reused = true;
        return;
      }
      const updated = await ProviderBalance.findOneAndUpdate(
        { provider_profile: profile._id, available_kobo: { $gte: amountKobo } },
        { $inc: { available_kobo: -amountKobo, reserved_kobo: amountKobo }, $set: { modified_at: new Date() } },
        { new: true, session }
      );
      if (!updated) throw new AppError("Insufficient available provider balance", 409);
      [payout] = await ProviderPayout.create([{
        provider_profile: profile._id,
        payout_method: method._id,
        amount_kobo: amountKobo,
        idempotency_key: idempotencyKey,
      }], { session });
      await ProviderLedgerEntry.create([{
        provider_profile: profile._id, account: "provider", entry_type: "payout_reserve", amount_kobo: -amountKobo,
        source_type: "payout", source_id: payout._id, source_key: `payout:${payout._id}:reserve`, description: "Provider payout requested",
      }], { session });
      await writeAuditEvent({ actor: userId, actorRole: "provider", action: "payout_requested", resourceType: "provider_payout", resourceId: payout._id, newState: "requested", metadata: { amount_kobo: amountKobo, payout_method_id: method._id.toString() }, session });
    });
  } catch (error) {
    if (error.code === 11000) {
      payout = await ProviderPayout.findOne({ provider_profile: profile._id, idempotency_key: idempotencyKey });
      if (!payout || payout.amount_kobo !== amountKobo || (payoutMethodId && payout.payout_method.toString() !== payoutMethodId.toString())) throw new AppError("Idempotency-Key was already used for a different payout request", 409);
      reused = true;
    } else throw error;
  } finally { await session.endSession(); }
  return { payout: serializePayout(await attachPayoutMethod(ProviderPayout.findById(payout._id))), balance: await getProviderEarnings(userId), reused };
};

const payoutStateEvent = async ({ payout, previous, next, actor, actorRole, action, reason, session }) => {
  payout.status = next;
  if (actor) payout.reviewed_by = actor;
  if (actor) payout.reviewed_at = new Date();
  if (reason !== undefined) payout.review_reason = reason?.trim() || null;
  await payout.save({ session });
  await writeAuditEvent({ actor, actorRole, action, resourceType: "provider_payout", resourceId: payout._id, priorState: previous, newState: next, correlationId: payout.transfer_attempts.at(-1)?.reference ?? null, metadata: reason ? { reason: reason.slice(0, 300) } : {}, session });
};

const releasePayoutHold = async (payout, reference, { session, reason, actor = null, actorRole = "system" } = {}) => {
  const key = `payout:${payout._id}:release:${reference}`;
  if (await ProviderLedgerEntry.exists({ source_key: key }).session(session)) return false;
  await ProviderBalance.updateOne({ provider_profile: payout.provider_profile }, { $inc: { available_kobo: payout.amount_kobo, reserved_kobo: -payout.amount_kobo }, $set: { modified_at: new Date() } }, { session });
  await ProviderLedgerEntry.create([{
    provider_profile: payout.provider_profile, account: "provider", entry_type: "payout_release", amount_kobo: payout.amount_kobo,
    source_type: "payout", source_id: payout._id, source_key: key, description: `Payout hold released: ${reason}`, actor,
  }], { session });
  return true;
};

export const settleProviderTransfer = async ({ reference, status, gatewayTransferId = null, failureReason = null }) => {
  if (!reference) return false;
  const session = await mongoose.startSession();
  try {
    let changed = false;
    await session.withTransaction(async () => {
      const payout = await ProviderPayout.findOne({ "transfer_attempts.reference": reference }).session(session);
      if (!payout) return;
      const attempt = payout.transfer_attempts.find((item) => item.reference === reference);
      if (!attempt || ["success", "failed", "reversed", "abandoned", "rejected"].includes(attempt.status)) return;
      const previous = payout.status;
      attempt.status = status;
      attempt.gateway_transfer_id = gatewayTransferId ?? attempt.gateway_transfer_id;
      attempt.failure_reason = failureReason ? String(failureReason).slice(0, 240) : null;
      attempt.modified_at = new Date();
      if (status === "success") {
        payout.status = "paid";
        payout.paid_at = new Date();
        await ProviderBalance.updateOne({ provider_profile: payout.provider_profile }, { $inc: { reserved_kobo: -payout.amount_kobo }, $set: { modified_at: new Date() } }, { session });
      } else if (["failed", "reversed", "abandoned", "rejected"].includes(status)) {
        payout.status = status === "reversed" ? "reversed" : "failed";
        await releasePayoutHold(payout, reference, { session, reason: status });
      } else {
        payout.status = status === "otp_required" ? "otp_required" : "processing";
      }
      await payout.save({ session });
      await writeAuditEvent({ eventKey: `payout:${payout._id}:transfer:${reference}:${status}`, actorRole: "system", action: "payout_transfer_status_changed", resourceType: "provider_payout", resourceId: payout._id, priorState: previous, newState: payout.status, correlationId: reference, metadata: { gateway_transfer_id: gatewayTransferId }, session });
      changed = true;
    });
    return changed;
  } finally { await session.endSession(); }
};

const startTransferAttempt = async (payoutId, actorId, { retry = false, actorRole = "admin", reason = "" } = {}) => {
  const session = await mongoose.startSession();
  let reference;
  try {
    await session.withTransaction(async () => {
      const payout = await ProviderPayout.findById(payoutId).session(session);
      if (!payout) throw new AppError("Payout request not found", 404);
      if (retry) {
        if (!["failed", "reversed"].includes(payout.status)) throw new AppError("Only a conclusively failed payout can be retried", 409);
        const balance = await ProviderBalance.findOneAndUpdate({ provider_profile: payout.provider_profile, available_kobo: { $gte: payout.amount_kobo } }, { $inc: { available_kobo: -payout.amount_kobo, reserved_kobo: payout.amount_kobo }, $set: { modified_at: new Date() } }, { new: true, session });
        if (!balance) throw new AppError("Insufficient available balance to retry this payout", 409);
      } else if (payout.status !== "requested") throw new AppError("Payout is not awaiting admin review", 409);
      const previous = payout.status;
      reference = newTransferReference();
      payout.status = "processing";
      payout.reviewed_by = actorId;
      payout.reviewed_at = new Date();
      payout.review_reason = reason.trim() || null;
      payout.transfer_attempts.push({ reference, status: "initializing" });
      await payout.save({ session });
      await writeAuditEvent({ actor: actorId, actorRole, action: retry ? "payout_retry_started" : "payout_approved_and_transfer_started", resourceType: "provider_payout", resourceId: payout._id, priorState: previous, newState: "processing", correlationId: reference, metadata: reason.trim() ? { reason: reason.trim().slice(0, 300) } : {}, session });
    });
  } finally { await session.endSession(); }
  return reference;
};

const submitPaystackTransfer = async (payoutId, reference) => {
  const payout = await ProviderPayout.findById(payoutId);
  const method = await ProviderPayoutMethod.findOne({ _id: payout.payout_method, provider_profile: payout.provider_profile, active: true }).select("+recipient_code");
  if (!method) throw new AppError("Payout method is no longer available", 409);
  try {
    const result = await initiatePaystackTransfer({ amountKobo: payout.amount_kobo, reference, recipientCode: method.recipient_code, reason: `GetTreat provider payout ${payout._id}` });
    const statusMap = { otp: "otp_required", received: "processing", pending: "processing", queued: "processing", success: "success", failed: "failed", reversed: "reversed", abandoned: "abandoned", rejected: "rejected" };
    const status = statusMap[result?.status] ?? "processing";
    if (result?.reference && result.reference !== reference) throw new AppError("Paystack transfer reference did not match", 502);
    if (result?.amount != null && Number(result.amount) !== payout.amount_kobo) throw new AppError("Paystack transfer amount did not match", 502);
    await updateTransferAttempt(reference, { status, transferCode: result?.transfer_code ?? null, transferId: result?.id == null ? null : String(result.id), failureReason: status === "failed" ? result?.reason : null });
  } catch (error) {
    // A timeout can happen after Paystack accepted the request. Keep the same reference
    // and the balance hold so reconciliation cannot send a duplicate transfer.
    await writeAuditEvent({ actorRole: "system", action: "payout_transfer_request_uncertain", resourceType: "provider_payout", resourceId: payout._id, newState: "processing", correlationId: reference, metadata: { upstream_status: error.statusCode ?? "unknown" } });
  }
  return getAdminPayout(payoutId);
};

const updateTransferAttempt = async (reference, { status, transferCode, transferId, failureReason }) => {
  const payout = await ProviderPayout.findOne({ "transfer_attempts.reference": reference });
  if (!payout) return false;
  const attempt = payout.transfer_attempts.find((item) => item.reference === reference);
  if (transferCode) {
    attempt.transfer_code = transferCode;
    await payout.save();
  }
  await settleProviderTransfer({ reference, status, gatewayTransferId: transferId, failureReason });
  return true;
};

export const reviewProviderPayout = async (payoutId, actorId, { decision, reason = "", actorRole = "admin" }) => {
  if (decision === "reject") {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const payout = await ProviderPayout.findById(payoutId).session(session);
        if (!payout) throw new AppError("Payout request not found", 404);
        if (payout.status !== "requested") throw new AppError("Payout is not awaiting admin review", 409);
        const previous = payout.status;
        await payoutStateEvent({ payout, previous, next: "rejected", actor: actorId, actorRole, action: "payout_rejected", reason, session });
        await releasePayoutHold(payout, `rejected-${payout._id}`, { session, reason: "rejected", actor: actorId, actorRole });
      });
    } finally { await session.endSession(); }
    return getAdminPayout(payoutId);
  }
  if (!env.paystackSecretKey) throw new AppError("Paystack payouts are not configured", 503);
  const reference = await startTransferAttempt(payoutId, actorId, { actorRole, reason });
  return submitPaystackTransfer(payoutId, reference);
};

export const retryProviderPayout = async (payoutId, actorId, actorRole = "admin") => {
  if (!env.paystackSecretKey) throw new AppError("Paystack payouts are not configured", 503);
  const reference = await startTransferAttempt(payoutId, actorId, { retry: true, actorRole });
  return submitPaystackTransfer(payoutId, reference);
};

export const finalizeProviderPayoutTransfer = async (payoutId, actorId, otp, actorRole = "admin") => {
  const payout = await ProviderPayout.findById(payoutId);
  if (!payout) throw new AppError("Payout request not found", 404);
  if (payout.status !== "otp_required") throw new AppError("Payout is not awaiting transfer OTP", 409);
  const attempt = payout.transfer_attempts.at(-1);
  if (!attempt?.transfer_code) throw new AppError("Paystack transfer code is missing; reconcile the transfer before continuing", 409);
  const result = await finalizePaystackTransfer({ transferCode: attempt.transfer_code, otp });
  const statusMap = { otp: "otp_required", received: "processing", pending: "processing", queued: "processing", success: "success", failed: "failed", reversed: "reversed", abandoned: "abandoned", rejected: "rejected" };
  const status = statusMap[result?.status] ?? "processing";
  await updateTransferAttempt(attempt.reference, { status, transferCode: attempt.transfer_code, transferId: result?.id == null ? null : String(result.id), failureReason: status === "failed" ? result?.reason : null });
  await writeAuditEvent({ actor: actorId, actorRole, action: "payout_transfer_otp_submitted", resourceType: "provider_payout", resourceId: payout._id, priorState: "otp_required", newState: status, correlationId: attempt.reference, metadata: { otp_stored: false } });
  return getAdminPayout(payoutId);
};

export const reconcileProviderPayout = async (payoutId, actorId, actorRole = "admin") => {
  const payout = await ProviderPayout.findById(payoutId);
  if (!payout) throw new AppError("Payout request not found", 404);
  const attempt = payout.transfer_attempts.at(-1);
  if (!attempt) throw new AppError("Payout has no transfer attempt", 409);
  const result = await verifyPaystackTransfer(attempt.reference);
  const statusMap = { otp: "otp_required", received: "processing", pending: "processing", queued: "processing", success: "success", failed: "failed", reversed: "reversed", abandoned: "abandoned", rejected: "rejected" };
  await updateTransferAttempt(attempt.reference, { status: statusMap[result?.status] ?? "processing", transferCode: result?.transfer_code ?? attempt.transfer_code, transferId: result?.id == null ? null : String(result.id), failureReason: result?.reason ?? null });
  await writeAuditEvent({ actor: actorId, actorRole, action: "payout_transfer_reconciled", resourceType: "provider_payout", resourceId: payout._id, priorState: payout.status, newState: statusMap[result?.status] ?? "processing", correlationId: attempt.reference });
  return getAdminPayout(payoutId);
};

export const processPaystackTransferWebhook = async (eventType, data) => {
  const reference = data?.reference;
  const status = { "transfer.success": "success", "transfer.failed": "failed", "transfer.reversed": "reversed" }[eventType];
  if (!status || typeof reference !== "string") return false;
  const payout = await ProviderPayout.findOne({ "transfer_attempts.reference": reference });
  if (!payout) return false;
  if (Number(data.amount) !== payout.amount_kobo || data.currency !== payout.currency) throw new AppError("Paystack transfer event does not match the payout", 409);
  return settleProviderTransfer({ reference, status, gatewayTransferId: data.id == null ? null : String(data.id), failureReason: data.reason ?? null });
};

const adminPayoutQuery = (query) => query
  .populate({ path: "provider_profile", select: "user", populate: { path: "user", select: "fullname" } })
  .populate({ path: "payout_method", select: "bank_code bank_name account_name account_last4 is_default active createdAt modifiedAt" });

export const listAdminPayouts = async ({ page, limit, status = "all" }) => {
  const filter = status === "all" ? {} : { status };
  const [items, total] = await Promise.all([
    adminPayoutQuery(ProviderPayout.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
    ProviderPayout.countDocuments(filter),
  ]);
  return { items: items.map((item) => ({ ...serializePayout(item), provider: item.provider_profile?.user ? { fullname: item.provider_profile.user.fullname } : null })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getAdminPayout = async (payoutId) => {
  const payout = await adminPayoutQuery(ProviderPayout.findById(payoutId));
  if (!payout) throw new AppError("Payout request not found", 404);
  const audit = await AuditLog.find({ resource_type: "provider_payout", resource_id: payout._id }).sort({ createdAt: 1 }).lean();
  return {
    ...serializePayout(payout),
    provider: payout.provider_profile?.user ? { fullname: payout.provider_profile.user.fullname } : null,
    audit_timeline: audit.map((event) => ({ action: event.action, prior_state: event.prior_state, new_state: event.new_state, created_at: event.createdAt, actor_role: event.actor_role, correlation_id: event.correlation_id })),
  };
};
