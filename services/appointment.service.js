import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import AppointmentType from "../models/appointment-type.model.js";
import AppointmentPaymentAttempt from "../models/appointment-payment-attempt.model.js";
import ProviderAvailability from "../models/provider-availability.model.js";
import PatientProfile from "../models/patient-profile.model.js";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderSubscription from "../models/provider-subscription.model.js";
import System from "../models/system.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/AppError.js";
import { calculateProviderPaymentSplit, postAppointmentPaymentEarnings, reverseAppointmentPaymentEarnings, writeAuditEvent } from "./financial-ledger.service.js";
import { initializePaystackCheckout, refundPaystackTransaction, verifyPaystackTransaction } from "./paystack.service.js";

const validId = mongoose.isValidObjectId;
const newReference = () => `gt4a${randomBytes(18).toString("hex")}`;
const activeSlots = ["pending", "accepted", "pending_payment"];
const getPatient = async (userId) => {
  const user = await User.findById(userId).select("email emailVerified accountStatus role");
  if (!user || user.role !== "patient" || !user.emailVerified || user.accountStatus !== "active") throw new AppError("An active verified patient account is required", 403);
  const profile = await PatientProfile.findOne({ user: user._id }).select("_id");
  if (!profile) throw new AppError("Patient profile not found", 404);
  return { user, profile };
};
const getProvider = async (userId) => {
  const user = await User.findById(userId).select("role emailVerified accountStatus");
  if (!user || user.role !== "provider" || !user.emailVerified || user.accountStatus !== "active") throw new AppError("An active verified provider account is required", 403);
  const profile = await ProviderProfile.findOne({ user: user._id });
  if (!profile) throw new AppError("Provider profile not found", 404);
  if (profile.approval_status !== "approved") throw new AppError("Provider approval is required", 403);
  return { user, profile };
};
const serializeAppointment = (appointment, payment = null) => ({
  id: appointment._id.toString(),
  patient_profile_id: appointment.patient_profile?.toString?.() ?? appointment.patient_profile?._id?.toString?.(),
  provider_profile_id: appointment.provider_profile?.toString?.() ?? appointment.provider_profile?._id?.toString?.(),
  provider_subscription_id: appointment.provider_subscription?.toString?.() ?? appointment.provider_subscription?._id?.toString?.(),
  appointment_type: { id: appointment.appointment_type?.toString?.() ?? appointment.appointment_type?._id?.toString?.(), name: appointment.appointment_type_snapshot.name },
  starts_at: appointment.starts_at,
  ends_at: appointment.ends_at,
  timezone: appointment.timezone,
  mode: appointment.mode,
  digital_option: appointment.digital_option,
  reason: appointment.reason,
  fee: { amount: appointment.fee_amount, currency: appointment.currency },
  status: appointment.status,
  provider: appointment.provider_profile?.user ? { fullname: appointment.provider_profile.user.fullname ?? null, professional_field: appointment.provider_profile.professional_field ?? null } : undefined,
  patient: appointment.patient_profile?.user ? { fullname: appointment.patient_profile.user.fullname ?? null } : undefined,
  payment: payment ? { reference: payment.reference, status: payment.status, authorization_url: payment.authorization_url } : undefined,
  created_at: appointment.createdAt,
  modified_at: appointment.modifiedAt,
});
const getLocalParts = (date, timezone) => {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  } catch { throw new AppError("Provider availability has an invalid timezone", 422); }
  const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { date: `${map.year}-${map.month}-${map.day}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday), minutes: Number(map.hour) * 60 + Number(map.minute) };
};
const findSlotWindows = (availability, start) => {
  const local = getLocalParts(start, availability.timezone);
  const exception = availability.exceptions.find((item) => item.date === local.date);
  if (exception) return exception.unavailable ? [] : exception.windows;
  return availability.weekly_schedule.find((item) => item.weekday === local.weekday)?.windows ?? [];
};
const assertAvailable = async (availability, start, excludeId = null) => {
  const end = new Date(start.getTime() + availability.duration_minutes * 60_000);
  const local = getLocalParts(start, availability.timezone);
  const startMinute = local.minutes;
  const endMinute = startMinute + availability.duration_minutes;
  const fits = findSlotWindows(availability, start).some((window) => {
    const [fromH, fromM] = window.start.split(":").map(Number);
    const [toH, toM] = window.end.split(":").map(Number);
    const fromMinute = fromH * 60 + fromM;
    return startMinute >= fromMinute && endMinute <= toH * 60 + toM && (startMinute - fromMinute) % availability.duration_minutes === 0;
  });
  if (!fits) throw new AppError("Selected time is outside the provider's published availability", 409);
  const conflict = await Appointment.exists({ provider_profile: availability.provider_profile, ...(excludeId ? { _id: { $ne: excludeId } } : {}), status: { $in: activeSlots }, starts_at: { $lt: end }, ends_at: { $gt: start } });
  if (conflict) throw new AppError("This appointment time is no longer available", 409);
  return end;
};

export const getProviderAvailability = async (providerProfileId) => {
  if (!validId(providerProfileId)) throw new AppError("Invalid provider profile ID", 400);
  const provider = await ProviderProfile.findOne({ _id: providerProfileId, approval_status: "approved" }).select("_id");
  if (!provider) throw new AppError("Approved provider not found", 404);
  const availability = await ProviderAvailability.findOne({ provider_profile: provider._id }).lean();
  if (!availability) return null;
  return { provider_profile_id: provider._id.toString(), timezone: availability.timezone, duration_minutes: availability.duration_minutes, fee: { amount: availability.fee_amount, currency: availability.currency }, weekly_schedule: availability.weekly_schedule, exceptions: availability.exceptions };
};

export const setMyProviderAvailability = async (userId, payload) => {
  const { profile, user } = await getProvider(userId);
  const availability = await ProviderAvailability.findOneAndUpdate({ provider_profile: profile._id }, { $set: payload, $setOnInsert: { provider_profile: profile._id } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  await writeAuditEvent({ eventKey: `provider-availability:${availability._id}:${availability.modifiedAt.getTime()}`, actor: user._id, actorRole: "provider", action: "provider_availability_updated", resourceType: "provider_availability", resourceId: availability._id, metadata: { duration_minutes: availability.duration_minutes, currency: availability.currency } });
  return getProviderAvailability(profile._id);
};

export const listAppointmentTypes = async () => AppointmentType.find({ active: true }).sort({ name: 1 }).select("name slug").lean().then((items) => items.map((item) => ({ id: item._id.toString(), name: item.name, slug: item.slug })));

export const startPatientAppointment = async (userId, payload, idempotencyKey) => {
  const { user, profile: patient } = await getPatient(userId);
  const existing = await AppointmentPaymentAttempt.findOne({ patient_profile: patient._id, idempotency_key: idempotencyKey });
  if (existing) {
    if (existing.status === "failed") throw new AppError("This checkout attempt failed. Start a new attempt with a new Idempotency-Key", 409);
    const appointment = await Appointment.findOne({ _id: existing.appointment, patient_profile: patient._id });
    if (!appointment || appointment.provider_profile.toString() !== payload.provider_profile_id || appointment.appointment_type.toString() !== payload.appointment_type_id || new Date(appointment.starts_at).toISOString() !== new Date(payload.starts_at).toISOString() || appointment.digital_option !== payload.digital_option || (appointment.reason ?? "") !== (payload.reason?.trim() || "")) throw new AppError("Idempotency-Key was already used for a different request", 409);
    return { appointment: serializeAppointment(appointment, existing), reused: true };
  }
  if (!validId(payload.provider_profile_id) || !validId(payload.appointment_type_id)) throw new AppError("Invalid provider or appointment type ID", 400);
  const { profile: providerProfile } = await getProvider((await ProviderProfile.findById(payload.provider_profile_id).select("user"))?.user);
  if (providerProfile._id.toString() !== payload.provider_profile_id) throw new AppError("Approved provider not found", 404);
  const type = await AppointmentType.findOne({ _id: payload.appointment_type_id, active: true });
  if (!type) throw new AppError("Active appointment type not found", 404);
  const now = new Date();
  const providerSubscription = await ProviderSubscription.findOne({
    patient_profile: patient._id,
    provider_profile: providerProfile._id,
    status: "active",
    starts_at: { $lte: now },
    $or: [{ ends_at: { $gt: now } }, { renewal_grace_ends_at: { $gt: now } }],
  }).select("_id");
  if (!providerSubscription) throw new AppError("An active subscription to this provider is required before booking", 403);
  const start = new Date(payload.starts_at);
  if (!Number.isFinite(start.getTime()) || start <= now || start.getTime() % 60_000 !== 0) throw new AppError("starts_at must be a future ISO date-time on a minute boundary", 400);
  const availability = await ProviderAvailability.findOne({ provider_profile: providerProfile._id });
  if (!availability) throw new AppError("Provider has not published appointment availability", 409);
  const end = await assertAvailable(availability, start);
  const amountKobo = Math.round(availability.fee_amount * 100);
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 1) throw new AppError("Provider appointment fee is invalid for Paystack", 422);
  const system = await System.findOne({ key: "global" }).select("platform_fee_percent").lean();
  const rate = Number(system?.platform_fee_percent ?? 15);
  const split = calculateProviderPaymentSplit(amountKobo, rate);
  const reference = newReference();
  let appointment;
  let attempt;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      [appointment] = await Appointment.create([{
        patient_profile: patient._id, provider_profile: providerProfile._id, provider_subscription: providerSubscription._id,
        appointment_type: type._id, appointment_type_snapshot: { name: type.name }, starts_at: start, ends_at: end,
        timezone: availability.timezone, mode: "digital", digital_option: payload.digital_option,
        reason: payload.reason?.trim() || null, fee_amount: availability.fee_amount, currency: availability.currency, status: "pending_payment",
      }], { session });
      [attempt] = await AppointmentPaymentAttempt.create([{
        appointment: appointment._id, provider_profile: providerProfile._id, patient_profile: patient._id,
        status: "initializing", reference, idempotency_key: idempotencyKey, amount_kobo: amountKobo,
        commission_rate_percent: rate, platform_fee_kobo: split.platformFeeKobo, provider_net_kobo: split.providerNetKobo,
        commission_snapshotted_at: now, billing_email: user.email,
      }], { session });
      appointment.payment_attempt = attempt._id;
      await appointment.save({ session });
      await writeAuditEvent({ eventKey: `appointment-payment:${attempt._id}:initializing`, actor: user._id, actorRole: "patient", action: "appointment_payment_initialized", resourceType: "appointment", resourceId: appointment._id, newState: "pending_payment", correlationId: reference, metadata: { amount_kobo: amountKobo }, session });
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError("This appointment slot was just booked. Choose another time", 409);
    throw error;
  } finally { await session.endSession(); }
  try {
    const checkout = await initializePaystackCheckout({ email: user.email, amountKobo, reference, metadata: { purpose: "provider_appointment", payment_attempt_id: attempt._id.toString(), appointment_id: appointment._id.toString(), provider_profile_id: providerProfile._id.toString(), patient_profile_id: patient._id.toString() } });
    if (checkout.reference !== reference || !checkout.authorization_url) throw new AppError("Paystack returned an invalid checkout response", 502);
    attempt.status = "pending"; attempt.authorization_url = checkout.authorization_url; attempt.access_code = checkout.access_code ?? null;
    await attempt.save();
    return { appointment: serializeAppointment(appointment, attempt), reused: false };
  } catch (error) {
    attempt.status = "failed"; attempt.failure_reason = String(error.message).slice(0, 300); await attempt.save();
    appointment.status = "cancelled"; await appointment.save();
    await writeAuditEvent({ eventKey: `appointment-payment:${attempt._id}:failed`, actorRole: "system", action: "appointment_payment_failed", resourceType: "appointment", resourceId: appointment._id, priorState: "pending_payment", newState: "cancelled", correlationId: reference });
    throw error;
  }
};

const assertVerified = (attempt, data) => {
  const metadata = typeof data.metadata === "string" ? JSON.parse(data.metadata) : data.metadata ?? {};
  if (data.status !== "success" || data.reference !== attempt.reference || data.amount !== attempt.amount_kobo || data.currency !== attempt.currency || data.customer?.email?.toLowerCase?.() !== attempt.billing_email.toLowerCase() || metadata.payment_attempt_id !== attempt._id.toString() || metadata.appointment_id !== attempt.appointment.toString()) throw new AppError("Paystack payment does not match the expected appointment", 409);
};

export const fulfillVerifiedAppointmentPayment = async (reference, data) => {
  const attempt = await AppointmentPaymentAttempt.findOne({ reference });
  if (!attempt) return false;
  if (attempt.status === "success") return true;
  if (["refunded", "reversed"].includes(attempt.status)) return false;
  if (["pending", "processing", "ongoing", "queued"].includes(data.status)) return false;
  if (["failed", "abandoned"].includes(data.status)) {
    const appointment = await Appointment.findById(attempt.appointment);
    attempt.status = "failed"; attempt.failure_reason = String(data.gateway_response ?? data.status).slice(0, 300);
    await attempt.save();
    if (appointment?.status === "pending_payment") { appointment.status = "cancelled"; await appointment.save(); }
    await writeAuditEvent({ eventKey: `appointment-payment:${attempt._id}:failed`, actorRole: "system", action: "appointment_payment_failed", resourceType: "appointment", resourceId: attempt.appointment, priorState: "pending_payment", newState: "cancelled", correlationId: attempt.reference });
    return false;
  }
  if (data.status === "reversed") { await processAppointmentRefund(reference, "charge.dispute.create"); return false; }
  assertVerified(attempt, data);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await AppointmentPaymentAttempt.findById(attempt._id).session(session);
      if (current.status === "success") return;
      const appointment = await Appointment.findById(current.appointment).session(session);
      if (!appointment) throw new AppError("Appointment not found", 404);
      if (!["pending_payment", "pending"].includes(appointment.status)) throw new AppError("Appointment is no longer eligible for payment fulfillment", 409);
      current.status = "success"; current.gateway_transaction_id = data.id == null ? null : String(data.id); current.verified_at = new Date(); current.failure_reason = null;
      await current.save({ session });
      if (appointment.status === "pending_payment") appointment.status = "pending";
      await appointment.save({ session });
      await postAppointmentPaymentEarnings(current, { session });
      await writeAuditEvent({ eventKey: `appointment-payment:${current._id}:success`, actorRole: "system", action: "appointment_payment_succeeded", resourceType: "appointment", resourceId: appointment._id, priorState: "pending_payment", newState: appointment.status, correlationId: current.reference, metadata: { gateway_transaction_id: current.gateway_transaction_id }, session });
    });
  } finally { await session.endSession(); }
  return true;
};

export const verifyMyAppointmentPayment = async (userId, appointmentId, reference) => {
  const { profile } = await getPatient(userId);
  const appointment = await Appointment.findOne({ _id: appointmentId, patient_profile: profile._id });
  if (!appointment) throw new AppError("Appointment not found", 404);
  const attempt = await AppointmentPaymentAttempt.findOne({ _id: appointment.payment_attempt, appointment: appointment._id });
  if (!attempt || attempt.reference !== reference) throw new AppError("Appointment payment reference not found", 404);
  const data = await verifyPaystackTransaction(reference);
  await fulfillVerifiedAppointmentPayment(reference, data);
  const updated = await Appointment.findById(appointment._id);
  const latest = await AppointmentPaymentAttempt.findById(attempt._id);
  return { appointment: serializeAppointment(updated, latest), payment_status: latest.status };
};

export const listMyAppointments = async (userId, actor, { page = 1, limit = 20, filter = "all" } = {}) => {
  const { profile } = actor === "patient" ? await getPatient(userId) : await getProvider(userId);
  const scope = actor === "patient" ? { patient_profile: profile._id } : { provider_profile: profile._id };
  const now = new Date();
  const query = { ...scope };
  if (filter === "upcoming") { query.status = { $in: ["pending", "accepted"] }; query.starts_at = { $gte: now }; }
  if (filter === "recently_booked") query.createdAt = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  if (filter === "completed" || filter === "missed") query.status = filter;
  const [items, total] = await Promise.all([
    Appointment.find(query).sort(filter === "recently_booked" ? { createdAt: -1 } : { starts_at: 1 }).skip((page - 1) * limit).limit(limit)
      .populate({ path: "provider_profile", select: "professional_field user", populate: { path: "user", select: "fullname" } })
      .populate({ path: "patient_profile", select: "user", populate: { path: "user", select: "fullname" } })
      .populate({ path: "payment_attempt", select: "reference status authorization_url" })
      .lean(),
    Appointment.countDocuments(query),
  ]);
  return {
    items: items.map((item) => serializeAppointment(item, item.payment_attempt)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

const requestFullRefund = async (appointment, actorUser, actorRole, reason) => {
  const attempt = await AppointmentPaymentAttempt.findOneAndUpdate(
    { _id: appointment.payment_attempt, status: "success" },
    { $set: { status: "refund_pending", refund_reason: reason } },
    { new: true }
  );
  if (!attempt) {
    const current = await AppointmentPaymentAttempt.findById(appointment.payment_attempt);
    if (current?.status === "refund_pending") return { status: "refund_pending", refund_reference: current.refund_reference ?? null };
    if (current?.status === "refunded") return { status: "refunded", refund_reference: current.refund_reference ?? null };
    throw new AppError("A verified successful payment is required to refund this appointment", 409);
  }
  await writeAuditEvent({ eventKey: `appointment-payment:${attempt._id}:refund-requested`, actor: actorUser, actorRole, action: "appointment_refund_requested", resourceType: "appointment_payment_attempt", resourceId: attempt._id, priorState: "success", newState: "refund_pending", correlationId: attempt.reference, metadata: { appointment_status: appointment.status } });
  try {
    if (!attempt.gateway_transaction_id) throw new AppError("Paystack transaction ID is missing; refund requires admin review", 409);
    const response = await refundPaystackTransaction({ transactionId: attempt.gateway_transaction_id, customerNote: "Appointment payment refund", merchantNote: `GetTreat appointment ${appointment._id}: ${reason}` });
    const updatedAttempt = await AppointmentPaymentAttempt.findOneAndUpdate(
      { _id: attempt._id, status: "refund_pending" },
      { $set: { refund_reference: response.reference ?? null } },
      { new: true }
    );
    return { status: updatedAttempt?.status ?? attempt.status, refund_reference: updatedAttempt?.refund_reference ?? response.reference ?? null };
  } catch (error) {
    await AppointmentPaymentAttempt.updateOne(
      { _id: attempt._id, status: "refund_pending" },
      { $set: { status: "success", failure_reason: `Refund request failed: ${String(error.message).slice(0, 240)}` } }
    );
    await writeAuditEvent({ eventKey: `appointment-payment:${attempt._id}:refund-request-failed`, actor: actorUser, actorRole, action: "appointment_refund_failed", resourceType: "appointment_payment_attempt", resourceId: attempt._id, priorState: "refund_pending", newState: "success", correlationId: attempt.reference });
    throw error;
  }
};

export const decideProviderAppointment = async (userId, appointmentId, decision, reason = null) => {
  const { profile, user } = await getProvider(userId);
  if (!validId(appointmentId)) throw new AppError("Invalid appointment ID", 400);
  const appointment = await Appointment.findOne({ _id: appointmentId, provider_profile: profile._id });
  if (!appointment) throw new AppError("Appointment not found", 404);
  if (appointment.status !== "pending") throw new AppError("Only pending paid appointments can be accepted or declined", 409);
  if (decision === "accept") {
    appointment.status = "accepted"; appointment.decided_at = new Date(); appointment.decision_reason = reason;
    await appointment.save();
    await writeAuditEvent({ eventKey: `appointment:${appointment._id}:accepted`, actor: user._id, actorRole: "provider", action: "appointment_accepted", resourceType: "appointment", resourceId: appointment._id, priorState: "pending", newState: "accepted" });
    return serializeAppointment(appointment);
  }
  appointment.status = "declined"; appointment.decided_at = new Date(); appointment.decision_reason = reason;
  await appointment.save();
  await writeAuditEvent({ eventKey: `appointment:${appointment._id}:declined`, actor: user._id, actorRole: "provider", action: "appointment_declined", resourceType: "appointment", resourceId: appointment._id, priorState: "pending", newState: "declined" });
  const refund = await requestFullRefund(appointment, user._id, "provider", "provider_declined");
  return { ...serializeAppointment(appointment), refund };
};

export const cancelMyAppointment = async (userId, appointmentId, reason = null) => {
  const { profile, user } = await getPatient(userId);
  if (!validId(appointmentId)) throw new AppError("Invalid appointment ID", 400);
  const appointment = await Appointment.findOne({ _id: appointmentId, patient_profile: profile._id });
  if (!appointment) throw new AppError("Appointment not found", 404);
  if (!["pending", "accepted"].includes(appointment.status)) throw new AppError("Only pending or accepted paid appointments can be cancelled", 409);
  const refund = await requestFullRefund(appointment, user._id, "patient", reason === "rescheduled" ? "rescheduled" : "patient_cancelled");
  return { appointment: serializeAppointment(appointment), refund };
};

export const processAppointmentRefund = async (reference, eventType) => {
  const attempt = await AppointmentPaymentAttempt.findOne({ reference });
  if (!attempt) return false;
  if (["refunded", "reversed"].includes(attempt.status)) return true;
  const reason = eventType === "refund.processed" ? "refunded" : "reversed";
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await AppointmentPaymentAttempt.findById(attempt._id).session(session);
    if (["refunded", "reversed"].includes(current.status)) return;
      const prior = current.status;
      current.status = reason; await current.save({ session });
      const appointment = await Appointment.findById(current.appointment).session(session);
      if (appointment) {
        appointment.status = reason === "refunded"
          ? (current.refund_reason === "provider_declined" ? "declined" : "cancelled")
          : "cancelled";
        await appointment.save({ session });
      }
      if (prior === "success" || prior === "refund_pending") await reverseAppointmentPaymentEarnings(current, reason, { session });
      await writeAuditEvent({ eventKey: `appointment-payment:${current._id}:${reason}`, actorRole: "system", action: "appointment_payment_status_changed", resourceType: "appointment", resourceId: current.appointment, priorState: prior, newState: reason, correlationId: current.reference, session });
    });
  } finally { await session.endSession(); }
  return true;
};

export const processAppointmentRefundFailure = async (reference, eventData = {}) => {
  const attempt = await AppointmentPaymentAttempt.findOne({ reference });
  if (!attempt || attempt.status === "refunded") return Boolean(attempt);
  if (attempt.status === "refund_failed") return true;
  if (attempt.status !== "refund_pending") return false;
  attempt.status = "refund_failed";
  attempt.failure_reason = `Paystack refund failed: ${String(eventData.reason ?? eventData.status ?? "unknown").slice(0, 250)}`;
  await attempt.save();
  await writeAuditEvent({ eventKey: `appointment-payment:${attempt._id}:refund-failed`, actorRole: "system", action: "appointment_refund_failed", resourceType: "appointment_payment_attempt", resourceId: attempt._id, priorState: "refund_pending", newState: "refund_failed", correlationId: attempt.reference });
  return true;
};

export const getAppointmentPaymentForWebhook = async (reference, transactionId = null) => {
  const query = reference ? { reference } : { gateway_transaction_id: String(transactionId) };
  return AppointmentPaymentAttempt.findOne(query).select("reference").lean();
};
