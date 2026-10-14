import test from "node:test";
import assert from "node:assert/strict";
import PatientProfile from "../models/patient-profile.model.js";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderPaymentAttempt from "../models/provider-payment-attempt.model.js";
import AppointmentPaymentAttempt from "../models/appointment-payment-attempt.model.js";
import PlatformPaymentAttempt from "../models/platform-payment-attempt.model.js";
import AdminProfile from "../models/admin-profile.model.js";
import { requireAdminPermission } from "../middlewares/admin-permission.middleware.js";
import {
  buildTransactionFilter,
  getProviderTransaction,
  listAdminTransactions,
  listPatientTransactions,
  serializeTransactionAttempt,
} from "../services/transaction.service.js";
import { validateTransactionId, validateTransactionListQuery } from "../validators/transaction.validator.js";

const patientUserId = "507f1f77bcf86cd799439011";
const patientProfileId = "507f1f77bcf86cd799439012";
const providerProfileId = "507f1f77bcf86cd799439013";
const transactionId = "507f1f77bcf86cd799439014";

const queryChain = (value) => ({
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean: async () => value,
});

const runMiddleware = (middleware, req) => new Promise((resolve, reject) => {
  middleware(req, {}, (error) => error ? reject(error) : resolve(req));
});

test("transaction list query validates bounded filters and sets defaults", async () => {
  const req = await runMiddleware(validateTransactionListQuery, { query: {} });
  assert.deepEqual(req.transactionFilters, {
    page: 1, limit: 20, status: "all", purpose: "all", sort: "newest", search: "",
  });

  await assert.rejects(runMiddleware(validateTransactionListQuery, { query: { limit: "101" } }), /limit must be an integer/);
  await assert.rejects(runMiddleware(validateTransactionListQuery, { query: { status: "active" } }), /not a supported transaction state/);
  await assert.rejects(runMiddleware(validateTransactionListQuery, { query: { user_id: patientUserId } }), /Unknown transaction query/);
});

test("transaction ID validation rejects malformed identifiers", async () => {
  await runMiddleware(validateTransactionId, { params: { transactionId } });
  await assert.rejects(runMiddleware(validateTransactionId, { params: { transactionId: "not-an-id" } }), /Invalid transaction ID/);
});

test("transaction filter keeps actor scope and treats search as literal text", () => {
  const filter = buildTransactionFilter(
    { patient_profile: patientProfileId },
    { status: "success", purpose: "initial", search: "a.*b" }
  );
  assert.equal(filter.patient_profile, patientProfileId);
  assert.equal(filter.status, "success");
  assert.equal(filter.purpose, "initial");
  assert.equal(filter.$or[0].reference.test("a.*b"), true);
  assert.equal(filter.$or[0].reference.test("axxb"), false);
});

test("transaction serialization exposes only role-relevant parties and persisted fields", () => {
  const attempt = {
    _id: transactionId,
    reference: "gt4m-reference",
    status: "success",
    purpose: "initial",
    amount_kobo: 135000,
    currency: "NGN",
    createdAt: new Date("2026-10-14T06:00:00.000Z"),
    verified_at: new Date("2026-10-14T06:01:00.000Z"),
    provider_service: "507f1f77bcf86cd799439015",
    provider_subscription: {
      _id: "507f1f77bcf86cd799439016",
      service_snapshot: { title: "Pregnancy care", billing_cycle: "monthly" },
    },
    provider_profile: { _id: providerProfileId, user: { fullname: "Alex Provider", email: "private@example.com" } },
    patient_profile: { _id: patientProfileId, user: { fullname: "Jane Patient", email: "private@example.com" } },
    billing_email: "private@example.com",
    idempotency_key: "private-key",
    access_code: "private-access-code",
    failure_reason: "private internal diagnostic",
  };

  const patient = serializeTransactionAttempt(attempt, "patient");
  const provider = serializeTransactionAttempt(attempt, "provider");
  const admin = serializeTransactionAttempt(attempt, "admin");
  assert.equal(patient.provider.fullname, "Alex Provider");
  assert.equal("patient" in patient, false);
  assert.equal(provider.patient.fullname, "Jane Patient");
  assert.equal("provider" in provider, false);
  assert.ok(admin.patient && admin.provider);
  assert.equal(patient.amount, 1350);
  assert.equal(patient.amount_minor, 135000);
  for (const result of [patient, provider, admin]) {
    assert.equal("billing_email" in result, false);
    assert.equal("idempotency_key" in result, false);
    assert.equal("access_code" in result, false);
    assert.equal("failure_reason" in result, false);
  }
});

test("patient transaction listing is scoped to their resolved profile and paginated", async (t) => {
  let attemptFilter;
  t.mock.method(PatientProfile, "findOne", () => ({ select: async () => ({ _id: patientProfileId }) }));
  t.mock.method(ProviderPaymentAttempt, "find", (filter) => {
    attemptFilter = filter;
    return queryChain([]);
  });
  t.mock.method(ProviderPaymentAttempt, "countDocuments", async () => 0);
  t.mock.method(AppointmentPaymentAttempt, "find", () => queryChain([{
    _id: transactionId, reference: "gt4a-reference", status: "success", amount_kobo: 150000,
    commission_rate_percent: 15, platform_fee_kobo: 22500, provider_net_kobo: 127500, currency: "NGN",
    createdAt: new Date("2026-10-15T10:00:00Z"), verified_at: new Date("2026-10-15T10:01:00Z"),
    provider_profile: { _id: providerProfileId, user: { fullname: "Doctor Doe" } },
    patient_profile: { _id: patientProfileId, user: { fullname: "Patient Jane" } },
    appointment: { _id: "507f1f77bcf86cd799439019", appointment_type_snapshot: { name: "Consultation" }, starts_at: new Date("2026-11-01T10:00:00Z"), status: "pending" },
  }]));
  t.mock.method(AppointmentPaymentAttempt, "countDocuments", async () => 1);
  t.mock.method(PlatformPaymentAttempt, "find", () => queryChain([]));
  t.mock.method(PlatformPaymentAttempt, "countDocuments", async () => 0);

  const result = await listPatientTransactions(patientUserId, {
    page: 2, limit: 10, status: "pending", purpose: "renewal", sort: "oldest", search: "gt4m",
  });
  assert.equal(attemptFilter.patient_profile, patientProfileId);
  assert.equal(attemptFilter.status, "pending");
  assert.equal(attemptFilter.purpose, "renewal");
  assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 0, pages: 0 });
});

test("provider transaction detail query enforces provider ownership", async (t) => {
  let attemptFilter;
  t.mock.method(ProviderProfile, "findOne", () => ({ select: async () => ({ _id: providerProfileId }) }));
  t.mock.method(ProviderPaymentAttempt, "findOne", (filter) => {
    attemptFilter = filter;
    return queryChain(null);
  });
  t.mock.method(AppointmentPaymentAttempt, "findOne", () => queryChain(null));

  await assert.rejects(getProviderTransaction("507f1f77bcf86cd799439017", transactionId), { statusCode: 404 });
  assert.equal(attemptFilter.provider_profile, providerProfileId);
  assert.equal(attemptFilter._id, transactionId);
});

test("admin transaction listing merges appointment transactions with provider-service history", async (t) => {
  let attemptFilter;
  t.mock.method(ProviderPaymentAttempt, "find", (filter) => {
    attemptFilter = filter;
    return queryChain([]);
  });
  t.mock.method(ProviderPaymentAttempt, "countDocuments", async () => 0);
  t.mock.method(AppointmentPaymentAttempt, "find", () => queryChain([{
    _id: transactionId, reference: "gt4a-reference", status: "success", amount_kobo: 150000,
    commission_rate_percent: 15, platform_fee_kobo: 22500, provider_net_kobo: 127500, currency: "NGN",
    createdAt: new Date("2026-10-15T10:00:00Z"), verified_at: new Date("2026-10-15T10:01:00Z"),
    provider_profile: { _id: providerProfileId, user: { fullname: "Doctor Doe" } },
    patient_profile: { _id: patientProfileId, user: { fullname: "Patient Jane" } },
    appointment: { _id: "507f1f77bcf86cd799439019", appointment_type_snapshot: { name: "Consultation" }, starts_at: new Date("2026-11-01T10:00:00Z"), status: "pending" },
  }]));
  t.mock.method(AppointmentPaymentAttempt, "countDocuments", async () => 1);
  t.mock.method(PlatformPaymentAttempt, "find", () => queryChain([]));
  t.mock.method(PlatformPaymentAttempt, "countDocuments", async () => 0);

  const result = await listAdminTransactions({
    page: 1, limit: 20, status: "all", purpose: "all", sort: "newest", search: "",
  });
  assert.deepEqual(attemptFilter, {});
  assert.equal(result.pagination.total, 1);
  assert.equal(result.items[0].purpose, "appointment");
  assert.equal(result.items[0].appointment.type, "Consultation");
});

test("appointment transaction serialization exposes appointment and commission fields safely", () => {
  const row = serializeTransactionAttempt({
    _id: transactionId, reference: "gt4a-reference", status: "success", purpose: "appointment",
    amount_kobo: 150000, commission_rate_percent: 15, platform_fee_kobo: 22500, provider_net_kobo: 127500,
    currency: "NGN", createdAt: new Date("2026-10-15T10:00:00Z"), verified_at: new Date("2026-10-15T10:01:00Z"),
    provider_profile: { _id: providerProfileId, user: { fullname: "Doctor Doe" } },
    patient_profile: { _id: patientProfileId, user: { fullname: "Patient Jane" } },
    appointment: { _id: "507f1f77bcf86cd799439019", appointment_type_snapshot: { name: "Consultation" }, starts_at: new Date("2026-11-01T10:00:00Z"), status: "pending" },
  }, "admin");
  assert.equal(row.purpose, "appointment");
  assert.equal(row.appointment.type, "Consultation");
  assert.equal(row.provider_net, 1275);
  assert.equal(row.patient.fullname, "Patient Jane");
  assert.equal(row.provider.fullname, "Doctor Doe");
  assert.equal(row.provider_service, null);
});

test("platform transaction serialization does not misstate platform revenue as provider earnings", () => {
  const row = serializeTransactionAttempt({
    _id: transactionId, reference: "gt4o-reference", status: "success", purpose: "platform_subscription",
    amount_kobo: 55500, currency: "NGN", createdAt: new Date("2026-10-15T10:00:00Z"),
    platform_subscription: { _id: transactionId, plan_snapshot: { billing_cycle: "monthly" }, status: "active" },
  }, "admin");
  assert.equal(row.product, "getreat_platform_subscription");
  assert.equal(row.platform_subscription.billing_cycle, "monthly");
  assert.equal("provider_net" in row, false);
  assert.equal("platform_fee" in row, false);
});

test("admin transaction access requires manage_transactions while super admin bypasses it", async (t) => {
  let hasPermission = false;
  t.mock.method(AdminProfile, "findOne", () => ({
    select: async () => ({ permissions: { manage_transactions: hasPermission } }),
  }));
  const middleware = requireAdminPermission("manage_transactions");
  const invoke = (user) => new Promise((resolve) => middleware({ user }, {}, (error) => resolve(error ?? null)));

  const denied = await invoke({ _id: "507f1f77bcf86cd799439018", role: "admin" });
  assert.equal(denied.statusCode, 403);
  hasPermission = true;
  assert.equal(await invoke({ _id: "507f1f77bcf86cd799439018", role: "admin" }), null);
  assert.equal(await invoke({ role: "super_admin" }), null);
});
