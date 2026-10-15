import test from "node:test";
import assert from "node:assert/strict";
import PlatformSubscription from "../models/platform-subscription.model.js";
import PlatformPaymentAttempt from "../models/platform-payment-attempt.model.js";
import { addPlatformBillingCycle } from "../services/platform-subscription.service.js";
import { validateStartPlatformSubscription, validatePlatformPlansUpdate } from "../validators/platform-subscription.validator.js";
import { createPlatformSubscriptionMiddleware } from "../middlewares/platform-subscription.middleware.js";

const runValidator = (validator, req) => new Promise((resolve, reject) => validator(req, {}, (error) => error ? reject(error) : resolve(req)));

test("platform billing dates support monthly, quarterly, and yearly cadence without overflowing month end", () => {
  const start = new Date("2026-01-31T10:00:00.000Z");
  assert.equal(addPlatformBillingCycle(start, "monthly").toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(addPlatformBillingCycle(start, "quarterly").toISOString(), "2026-04-30T10:00:00.000Z");
  assert.equal(addPlatformBillingCycle(start, "yearly").toISOString(), "2027-01-31T10:00:00.000Z");
});

test("platform subscription schema keeps platform billing state separate and requires a plan snapshot", async () => {
  const sub = new PlatformSubscription({ patient_profile: "507f1f77bcf86cd799439011", status: "pending_payment" });
  await assert.rejects(sub.validate());
  sub.plan_snapshot = { billing_cycle: "quarterly", amount: 1500, currency: "NGN" };
  await assert.doesNotReject(sub.validate());
  assert.equal(PlatformSubscription.schema.path("provider_service"), undefined);
});

test("active platform subscription uniqueness uses a named partial index without duplicate path indexes", () => {
  const patientProfileIndexes = PlatformSubscription.schema.indexes().filter(([keys]) => Object.keys(keys).includes("patient_profile"));
  assert.equal(patientProfileIndexes.some(([keys, options]) => Object.keys(keys).length === 1 && !options.unique), false);
  const uniqueIndex = patientProfileIndexes.find(([, options]) => options.name === "uniq_active_platform_subscription_per_patient");
  assert.ok(uniqueIndex);
  assert.equal(uniqueIndex[1].unique, true);
});

test("platform payment attempt requires a unique Paystack reference and minor-unit amount", async () => {
  const attempt = new PlatformPaymentAttempt({ platform_subscription: "507f1f77bcf86cd799439011", patient_profile: "507f1f77bcf86cd799439012", purpose: "initial", reference: "gt4o-test-reference", amount_kobo: 55500, billing_email: "patient@example.com" });
  await assert.doesNotReject(attempt.validate());
  assert.equal(PlatformPaymentAttempt.schema.path("authorization_code_encrypted"), undefined);
});

test("platform checkout requires a supported plan and Idempotency-Key", async () => {
  const req = { body: { billing_cycle: "yearly", auto_renew: true }, get: () => "patient-platform-attempt-1" };
  await runValidator(validateStartPlatformSubscription, req);
  assert.equal(req.autoRenew, true);
  await assert.rejects(runValidator(validateStartPlatformSubscription, { body: { billing_cycle: "weekly" }, get: () => "patient-platform-attempt-1" }), { statusCode: 400 });
  await assert.rejects(runValidator(validateStartPlatformSubscription, { body: { billing_cycle: "monthly" }, get: () => undefined }), { statusCode: 400 });
});

test("super-admin plan update requires all three unique valid NGN cadences", async () => {
  const req = { body: { enabled: true, plans: [
    { billing_cycle: "monthly", amount: 555, active: true },
    { billing_cycle: "quarterly", amount: 1500, active: true },
    { billing_cycle: "yearly", amount: 5500, active: true },
  ] } };
  await runValidator(validatePlatformPlansUpdate, req);
  assert.deepEqual(req.body.plans.map((plan) => plan.billing_cycle), ["monthly", "quarterly", "yearly"]);
  await assert.rejects(runValidator(validatePlatformPlansUpdate, { body: { enabled: true, plans: [{ billing_cycle: "monthly", amount: -1, active: true }, { billing_cycle: "monthly", amount: 3, active: true }, { billing_cycle: "yearly", amount: 4, active: false }] } }), { statusCode: 400 });
});

test("platform entitlement middleware gates only patient feature requests", async (t) => {
  let active = false;
  const middleware = createPlatformSubscriptionMiddleware(async () => active);
  const invoke = (role) => new Promise((resolve) => middleware({ user: { role, _id: "507f1f77bcf86cd799439011" } }, {}, (error) => resolve(error ?? null)));
  assert.equal((await invoke("patient")).statusCode, 403);
  active = true;
  assert.equal(await invoke("patient"), null);
  active = false;
  assert.equal(await invoke("provider"), null);
});
