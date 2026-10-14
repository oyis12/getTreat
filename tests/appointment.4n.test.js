import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import AppointmentPaymentAttempt from "../models/appointment-payment-attempt.model.js";
import AppointmentType from "../models/appointment-type.model.js";
import ProviderAvailability from "../models/provider-availability.model.js";
import { calculateProviderPaymentSplit } from "../services/financial-ledger.service.js";
import { validateAvailabilityPayload, validateStartAppointment, validateAppointmentListQuery } from "../validators/appointment.validator.js";

const runMiddleware = (middleware, req) => new Promise((resolve, reject) => middleware(req, {}, (error) => error ? reject(error) : resolve(req)));
const validId = () => new mongoose.Types.ObjectId().toString();

test("4N appointment records enforce actor, subscription, slot, and paid-pending workflow data", async () => {
  const appointment = new Appointment({
    patient_profile: new mongoose.Types.ObjectId(), provider_profile: new mongoose.Types.ObjectId(),
    provider_subscription: new mongoose.Types.ObjectId(), appointment_type: new mongoose.Types.ObjectId(),
    appointment_type_snapshot: { name: "Consultation" }, starts_at: new Date("2026-10-20T10:00:00.000Z"),
    ends_at: new Date("2026-10-20T10:30:00.000Z"), timezone: "Africa/Lagos", digital_option: "video_call", fee_amount: 1500,
  });
  await assert.doesNotReject(appointment.validate());
  assert.equal(appointment.status, "pending_payment");
  appointment.status = "accepted";
  await assert.doesNotReject(appointment.validate());
  appointment.status = "booked";
  await assert.rejects(appointment.validate());
  const slotIndex = Appointment.schema.indexes().find(([keys, options]) => keys.provider_profile && keys.starts_at && options.unique);
  assert.ok(slotIndex);
  assert.deepEqual(slotIndex[1].partialFilterExpression.status.$in, ["pending", "accepted", "pending_payment"]);
});

test("4N appointment payment snapshots idempotency, NGN kobo amounts and commission independently", async () => {
  const attempt = new AppointmentPaymentAttempt({
    appointment: new mongoose.Types.ObjectId(), provider_profile: new mongoose.Types.ObjectId(), patient_profile: new mongoose.Types.ObjectId(),
    reference: "gt4a-appointment-test", idempotency_key: "appointment-key-123", amount_kobo: 150000,
    commission_rate_percent: 15, platform_fee_kobo: 22500, provider_net_kobo: 127500,
    commission_snapshotted_at: new Date(), billing_email: "patient@example.com",
  });
  await assert.doesNotReject(attempt.validate());
  assert.deepEqual(calculateProviderPaymentSplit(attempt.amount_kobo, attempt.commission_rate_percent), { platformFeeKobo: attempt.platform_fee_kobo, providerNetKobo: attempt.provider_net_kobo });
  const index = AppointmentPaymentAttempt.schema.indexes().find(([keys, options]) => keys.patient_profile && keys.idempotency_key && options.unique);
  assert.ok(index);
  assert.equal(AppointmentPaymentAttempt.schema.path("provider_service"), undefined);
});

test("appointment type catalogue and provider availability persist the approved options", async () => {
  const type = new AppointmentType({ name: "Consultation", slug: "consultation" });
  await assert.doesNotReject(type.validate());
  const availability = new ProviderAvailability({
    provider_profile: new mongoose.Types.ObjectId(), timezone: "Africa/Lagos", duration_minutes: 30, fee_amount: 1500,
    weekly_schedule: [{ weekday: 1, windows: [{ start: "09:00", end: "12:00" }] }],
    exceptions: [{ date: "2026-10-20", unavailable: true, windows: [] }],
  });
  await assert.doesNotReject(availability.validate());
  assert.equal(availability.currency, "NGN");
});

test("availability and patient booking validators reject unsafe or unsupported values", async () => {
  await runMiddleware(validateAvailabilityPayload, { body: {
    timezone: "Africa/Lagos", duration_minutes: 30, fee_amount: 1500,
    weekly_schedule: [{ weekday: 1, windows: [{ start: "09:00", end: "12:00" }] }], exceptions: [],
  } });
  await assert.rejects(runMiddleware(validateAvailabilityPayload, { body: {
    timezone: "Africa/Lagos", duration_minutes: 30, fee_amount: 1500,
    weekly_schedule: [{ weekday: 1, windows: [{ start: "09:00", end: "12:00" }, { start: "11:00", end: "13:00" }] }], exceptions: [],
  } }), /cannot overlap/);
  await assert.rejects(runMiddleware(validateAvailabilityPayload, { body: {
    timezone: "Africa/Lagos", duration_minutes: 45, fee_amount: 1500, weekly_schedule: [], exceptions: [],
  } }), /duration_minutes/);
  const request = { body: { provider_profile_id: validId(), appointment_type_id: validId(), starts_at: "2026-10-20T10:00:00.000Z", digital_option: "video_call", reason: "Check-in" }, get: (name) => name === "Idempotency-Key" ? "appt-test-key-123" : undefined };
  await runMiddleware(validateStartAppointment, request);
  assert.equal(request.idempotencyKey, "appt-test-key-123");
  await assert.rejects(runMiddleware(validateStartAppointment, { ...request, body: { ...request.body, fee_amount: 1 } }), /Unknown appointment field/);
  await runMiddleware(validateAppointmentListQuery, { query: { page: "2", limit: "15", filter: "upcoming" } }).then((req) => assert.deepEqual(req.appointmentList, { page: 2, limit: 15, filter: "upcoming" }));
  await assert.rejects(runMiddleware(validateAppointmentListQuery, { query: { limit: "1000" } }), /limit must be from 1 to 100/);
});
