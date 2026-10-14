import test from "node:test";
import assert from "node:assert/strict";
import ProviderProfile from "../models/provider-profile.model.js";
import ProviderService from "../models/provider-service.model.js";
import User from "../models/user.model.js";
import { createProviderService, updateProviderService, listPatientProviderServices } from "../services/provider-service.service.js";

const providerId = "507f1f77bcf86cd799439011";
const profileId = "507f1f77bcf86cd799439012";
const serviceId = "507f1f77bcf86cd799439013";

test("pending provider cannot create a service offering", async (t) => {
  t.mock.method(ProviderProfile, "findOne", async () => ({ approval_status: "pending" }));
  t.mock.method(User, "findById", () => { throw new Error("Unapproved provider must stop before user query"); });
  t.mock.method(ProviderService, "create", () => { throw new Error("Unapproved provider must not create offerings"); });
  await assert.rejects(createProviderService(providerId, { title: "Care", original_price: 1000, billing_cycle: "monthly" }), { statusCode: 403 });
});

test("provider updates only a service owned by their provider profile", async (t) => {
  let ownershipFilter;
  t.mock.method(ProviderProfile, "findOne", async () => ({ _id: profileId, approval_status: "approved" }));
  t.mock.method(User, "findById", () => ({ select: async () => ({ role: "provider", emailVerified: true, accountStatus: "active" }) }));
  const service = { _id: serviceId, title: "Old title", original_price: 1500, discount_percent: 0, billing_cycle: "monthly", active: true, save: async () => {} };
  t.mock.method(ProviderService, "findOne", async (filter) => { ownershipFilter = filter; return service; });
  const result = await updateProviderService(providerId, serviceId, { title: "New title" });
  assert.equal(ownershipFilter._id, serviceId);
  assert.equal(ownershipFilter.provider_profile, profileId);
  assert.equal(result.title, "New title");
});

test("patient discovery only queries active offerings from approved active providers", async (t) => {
  let pipeline;
  t.mock.method(ProviderService, "aggregate", async (value) => { pipeline = value; return [{ items: [], total: [] }]; });
  const result = await listPatientProviderServices({ page: 1, limit: 20, search: "doctor", professionalField: null, discountOnly: false, providerProfileId: null });
  const serializedPipeline = JSON.stringify(pipeline);
  assert.match(serializedPipeline, /\"active\":true/);
  assert.match(serializedPipeline, /\"provider_profile.approval_status\":\"approved\"/);
  assert.match(serializedPipeline, /\"provider_user.accountStatus\":\"active\"/);
  assert.match(serializedPipeline, /\"provider_user.emailVerified\":true/);
  assert.deepEqual(result.items, []);
});
