import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import PatientProfile from "../models/patient-profile.model.js";
import ProviderInstruction from "../models/provider-instruction.model.js";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderSubscription from "../models/provider-subscription.model.js";
import User from "../models/user.model.js";
import {
  createProviderInstruction,
  getCurrentPatientInstruction,
} from "../services/provider-instruction.service.js";
import {
  assertActiveProviderSubscription,
  assertApprovedProvider,
  getProviderSubscriptionDisplayStatus,
  isProviderSubscriptionActive,
} from "../services/provider-access.policy.js";

const now = new Date("2026-10-13T12:00:00.000Z");

test("only a currently active provider subscription authorizes new instructions", () => {
  const active = {
    status: "active",
    starts_at: "2026-10-01T00:00:00.000Z",
    ends_at: "2026-11-01T00:00:00.000Z",
  };
  assert.equal(isProviderSubscriptionActive(active, now), true);
  assert.doesNotThrow(() => assertActiveProviderSubscription(active, now));
  assert.equal(getProviderSubscriptionDisplayStatus(active, now), "active");
});

test("expired, future, and out-of-period subscriptions cannot authorize new instructions", () => {
  const expired = {
    status: "active",
    starts_at: "2026-09-01T00:00:00.000Z",
    ends_at: "2026-10-01T00:00:00.000Z",
  };
  const notStarted = {
    status: "active",
    starts_at: "2026-11-01T00:00:00.000Z",
    ends_at: "2026-12-01T00:00:00.000Z",
  };
  const markedExpired = { ...expired, status: "expired", ends_at: "2026-12-01T00:00:00.000Z" };

  for (const subscription of [expired, notStarted, markedExpired, null]) {
    assert.equal(isProviderSubscriptionActive(subscription, now), false);
    assert.equal(getProviderSubscriptionDisplayStatus(subscription, now), "expired");
    assert.throws(() => assertActiveProviderSubscription(subscription, now), { statusCode: 403 });
  }
});

test("an opted-in subscription keeps provider access during its renewal grace period", () => {
  const grace = {
    status: "active",
    starts_at: "2026-09-01T00:00:00.000Z",
    ends_at: "2026-10-10T00:00:00.000Z",
    renewal_grace_ends_at: "2026-10-17T00:00:00.000Z",
  };
  assert.equal(isProviderSubscriptionActive(grace, now), true);
  assert.equal(isProviderSubscriptionActive(grace, new Date("2026-10-17T00:00:00.000Z")), false);
});

test("only admin-approved provider profiles can use provider instruction features", () => {
  assert.doesNotThrow(() => assertApprovedProvider({ approval_status: "approved" }));
  for (const profile of [null, { approval_status: "pending" }, { approval_status: "rejected" }]) {
    assert.throws(() => assertApprovedProvider(profile), { statusCode: 403 });
  }
});

test("provider cannot create an instruction without an active provider subscription", async (t) => {
  const providerId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();
  const patientProfileId = new mongoose.Types.ObjectId();
  const providerProfileId = new mongoose.Types.ObjectId();
  let subscriptionFilter;

  t.mock.method(ProviderProfile, "findOne", async () => ({
    _id: providerProfileId,
    user: providerId,
    approval_status: "approved",
    professional_field: "gynecology",
  }));
  t.mock.method(User, "findById", () => ({
    select: async () => ({ role: "patient" }),
  }));
  t.mock.method(PatientProfile, "findOne", () => ({
    select: async () => ({ _id: patientProfileId }),
  }));
  t.mock.method(ProviderSubscription, "findOne", (filter) => {
    subscriptionFilter = filter;
    return { select: async () => null };
  });
  const createInstruction = t.mock.method(ProviderInstruction, "create", async () => {
    throw new Error("Instruction create must not run without active access");
  });

  await assert.rejects(
    createProviderInstruction(
      { _id: providerId, fullname: "Dr Example" },
      patientId.toString(),
      { instruction: "Test instruction" }
    ),
    { statusCode: 403 }
  );
  assert.equal(subscriptionFilter.provider_profile.toString(), providerProfileId.toString());
  assert.equal(subscriptionFilter.patient_profile.toString(), patientProfileId.toString());
  assert.equal(subscriptionFilter.status, "active");
  assert.ok(subscriptionFilter.starts_at.$lte instanceof Date);
  assert.ok(subscriptionFilter.$or.some((filter) => filter.ends_at?.$gt instanceof Date));
  assert.equal(createInstruction.mock.callCount(), 0);
});

test("patient can read their own historical instruction without an active subscription", async (t) => {
  const patientId = new mongoose.Types.ObjectId();
  const patientProfileId = new mongoose.Types.ObjectId();
  const instructionId = new mongoose.Types.ObjectId();
  let instructionFilter;

  t.mock.method(PatientProfile, "findOne", () => ({
    select: async () => ({ _id: patientProfileId }),
  }));
  t.mock.method(ProviderSubscription, "findOne", () => {
    throw new Error("Patient-owned history must not require an active subscription");
  });
  t.mock.method(ProviderInstruction, "findOne", async (filter) => {
    instructionFilter = filter;
    return {
      _id: instructionId,
      provider_profile: new mongoose.Types.ObjectId(),
      provider_name: "Dr Example",
      provider_profession: "Gynecology",
      instruction: "Historical instruction",
      prescription: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  });

  const result = await getCurrentPatientInstruction(patientId.toString(), instructionId.toString());
  assert.equal(instructionFilter._id.toString(), instructionId.toString());
  assert.equal(instructionFilter.patient_profile.toString(), patientProfileId.toString());
  assert.equal(result.instruction, "Historical instruction");
  assert.equal(result.doctor.name, "Dr Example");
});
