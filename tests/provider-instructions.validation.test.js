import test from "node:test";
import assert from "node:assert/strict";
import ProviderInstruction from "../models/provider-instruction.model.js";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderSubscription from "../models/provider-subscription.model.js";
import {
  validateCreateProviderInstruction,
  validatePaginationQuery,
  validateProviderApprovalPayload,
  validateProviderPatientListQuery,
  validateProviderProfileListQuery,
  validateProviderProfilePayload,
  validateProviderServicePayload,
  validatePatientProviderServiceQuery,
} from "../validators/provider.validator.js";

const runMiddleware = (middleware, req = {}) =>
  new Promise((resolve, reject) => {
    middleware(req, {}, (error) => (error ? reject(error) : resolve(req)));
  });

const objectId = "507f1f77bcf86cd799439011";

test("provider registration validates profile fields, explicit consents, and profession", async () => {
  const registration = {
    professional_field: "gynecology",
    years_experience: "4",
    bio: "Provider bio",
    country: "Nigeria",
    state: "Lagos",
    address: "Example address",
    credentials_valid: "true",
    regulations_agreed: "true",
    professional_data_consent: "true",
  };
  await runMiddleware(validateProviderProfilePayload, {
    body: { ...registration },
  });
  await assert.rejects(
    runMiddleware(validateProviderProfilePayload, {
      body: { ...registration, approval_status: "approved" },
    }),
    /Unknown provider profile field/
  );
  await assert.rejects(
    runMiddleware(validateProviderProfilePayload, {
      body: { ...registration, professional_field: "surgeon" },
    }),
    /Select a valid professional field/
  );
  await assert.rejects(runMiddleware(validateProviderProfilePayload, {
    body: { ...registration, professional_data_consent: "false" },
  }), /professional_data_consent consent is required/);
  await assert.rejects(runMiddleware(validateProviderProfilePayload, {
    body: { ...registration, professional_field: "others", professional_field_other: "" },
  }), /professional_field_other is required/);
  await assert.rejects(runMiddleware(validateProviderProfilePayload, {
    body: { ...registration, years_experience: "1.5" },
  }), /years_experience must be an integer/);
});

test("provider profile list defaults to pending and validates status and pagination", async () => {
  const req = await runMiddleware(validateProviderProfileListQuery, { query: {} });
  assert.deepEqual(req.pagination, { page: 1, limit: 20 });
  assert.equal(req.approvalStatus, "pending");

  const allReq = await runMiddleware(validateProviderProfileListQuery, {
    query: { approval_status: "all", page: "2", limit: "50" },
  });
  assert.equal(allReq.approvalStatus, null);
  assert.deepEqual(allReq.pagination, { page: 2, limit: 50 });

  await assert.rejects(
    runMiddleware(validateProviderProfileListQuery, { query: { approval_status: "active" } }),
    /approval_status must be/
  );
});

test("admin approval accepts approved or rejected and rejects client-controlled fields", async () => {
  await runMiddleware(validateProviderApprovalPayload, {
    params: { providerProfileId: objectId },
    body: { approval_status: "approved" },
  });
  await assert.rejects(
    runMiddleware(validateProviderApprovalPayload, {
      params: { providerProfileId: objectId },
      body: { approval_status: "pending" },
    }),
    /approval_status must be approved or rejected/
  );
  await assert.rejects(
    runMiddleware(validateProviderApprovalPayload, {
      params: { providerProfileId: objectId },
      body: { approval_status: "approved", action_by: objectId },
    }),
    /Unknown provider approval field/
  );
});

test("provider instruction accepts only instruction and optional prescription text", async () => {
  await runMiddleware(validateCreateProviderInstruction, {
    params: { patientId: objectId },
    body: { instruction: "Follow the care plan.", prescription: "1. Example item" },
  });

  await assert.rejects(
    runMiddleware(validateCreateProviderInstruction, {
      params: { patientId: objectId },
      body: { instruction: "   " },
    }),
    /instruction is required/
  );
  await assert.rejects(
    runMiddleware(validateCreateProviderInstruction, {
      params: { patientId: objectId },
      body: { instruction: "Follow the care plan.", patient_id: objectId },
    }),
    /Unknown instruction field/
  );
  await assert.rejects(
    runMiddleware(validateCreateProviderInstruction, {
      params: { patientId: objectId },
      body: { instruction: "Follow the care plan.", prescription: [] },
    }),
    /prescription must be a string or null/
  );
});

test("provider and patient instruction list pagination is bounded and validates filters", async () => {
  const req = await runMiddleware(validateProviderPatientListQuery, { query: {} });
  assert.deepEqual(req.pagination, { page: 1, limit: 20, status: "all" });

  await assert.rejects(
    runMiddleware(validateProviderPatientListQuery, {
      query: { status: "pending" },
    }),
    /status must be all, active, or expired/
  );
  await assert.rejects(
    runMiddleware(validatePaginationQuery, { query: { limit: "101" } }),
    /limit must be an integer from 1 to 100/
  );
});

test("provider service payload validates provider-controlled title, price, discount, and cadence", async () => {
  await runMiddleware(validateProviderServicePayload, { method: "POST", body: { title: "Monthly care", original_price: "1500", discount_percent: "10", billing_cycle: "monthly" } });
  await assert.rejects(runMiddleware(validateProviderServicePayload, { method: "POST", body: { title: "Care", original_price: "0", billing_cycle: "monthly" } }), /positive amount/);
  await assert.rejects(runMiddleware(validateProviderServicePayload, { method: "POST", body: { title: "Care", original_price: "1500", discount_percent: "100", billing_cycle: "monthly" } }), /discount_percent must be/);
  await assert.rejects(runMiddleware(validateProviderServicePayload, { method: "POST", body: { title: "Care", original_price: "1500", billing_cycle: "weekly" } }), /billing_cycle must be/);
  await assert.rejects(runMiddleware(validateProviderServicePayload, { method: "PATCH", body: { active: true } }), /Unknown provider service field/);
});

test("patient provider-service discovery validates pagination and filter values", async () => {
  const req = await runMiddleware(validatePatientProviderServiceQuery, { query: { search: "Nutrition", discount_only: "true" }, params: {} });
  assert.equal(req.providerServiceQuery.search, "Nutrition");
  assert.equal(req.providerServiceQuery.discountOnly, true);
  await assert.rejects(runMiddleware(validatePatientProviderServiceQuery, { query: { discount_only: "yes" }, params: {} }), /discount_only must be/);
  await assert.rejects(runMiddleware(validatePatientProviderServiceQuery, { query: { professional_field: "doctor" }, params: {} }), /valid professional_field/);
});

test("provider profile model defaults to pending and keeps approval history attributable", async () => {
  const profile = new ProviderProfile({
    user: objectId,
    professional_field: "physiotherapist",
  });
  assert.equal(profile.approval_status, "pending");
  await assert.doesNotReject(profile.validate());

  const invalid = new ProviderProfile({ user: objectId, professional_field: "doctor" });
  await assert.rejects(invalid.validate(), (error) => Boolean(error.errors.professional_field));
});

test("provider subscription model requires a valid active/expired period", async () => {
  const valid = new ProviderSubscription({
    provider_profile: objectId,
    provider_service: "507f1f77bcf86cd799439013",
    patient_profile: "507f1f77bcf86cd799439012",
    status: "active",
    service_snapshot: { title: "Pregnancy care", original_price: 1500, discount_percent: 10, discounted_price: 1350, currency: "NGN", billing_cycle: "monthly" },
    starts_at: "2026-01-01T00:00:00.000Z",
    ends_at: "2026-02-01T00:00:00.000Z",
  });
  await assert.doesNotReject(valid.validate());

  const invalid = new ProviderSubscription({
    provider_profile: objectId,
    provider_service: "507f1f77bcf86cd799439013",
    patient_profile: "507f1f77bcf86cd799439012",
    status: "active",
    service_snapshot: { title: "Pregnancy care", original_price: 1500, discount_percent: 10, discounted_price: 1350, currency: "NGN", billing_cycle: "monthly" },
    starts_at: "2026-02-01T00:00:00.000Z",
    ends_at: "2026-01-01T00:00:00.000Z",
  });
  await assert.rejects(invalid.validate(), (error) => Boolean(error.errors.ends_at));
});

test("provider instruction model requires content and both actor profiles", async () => {
  const instruction = new ProviderInstruction({
    provider_profile: objectId,
    patient_profile: "507f1f77bcf86cd799439012",
    provider_name: "Dr Example",
    provider_profession: "Gynecology",
    instruction: "Follow the care plan.",
  });
  await assert.doesNotReject(instruction.validate());
  assert.equal(instruction.prescription, null);

  const invalid = new ProviderInstruction({});
  await assert.rejects(invalid.validate(), (error) =>
    Boolean(
      error.errors.provider_profile &&
      error.errors.patient_profile &&
      error.errors.instruction
    )
  );
});

test("provider service model validates cadence, price, and discount range", async () => {
  const ProviderService = (await import("../models/provider-service.model.js")).default;
  const service = new ProviderService({ provider_profile: objectId, title: "Monthly care", original_price: 1500, discount_percent: 10, billing_cycle: "monthly" });
  await assert.doesNotReject(service.validate());
  const invalid = new ProviderService({ provider_profile: objectId, title: "Care", original_price: -1, discount_percent: 120, billing_cycle: "weekly" });
  await assert.rejects(invalid.validate(), (error) => Boolean(error.errors.original_price && error.errors.discount_percent && error.errors.billing_cycle));
});
