import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import ProviderSubscription from "../models/provider-subscription.model.js";
import ProviderPaymentAttempt from "../models/provider-payment-attempt.model.js";
import {
  addBillingCycle,
  getProviderRenewalRetryAt,
} from "../services/provider-subscription.service.js";
import { verifyPaystackWebhookSignature } from "../services/paystack.service.js";
import { decryptPaymentToken, encryptPaymentToken } from "../utils/payment-token-crypto.js";
import {
  validateAutoRenew,
  validateStartProviderSubscription,
} from "../validators/provider-subscription.validator.js";

const runMiddleware = (middleware, req) => new Promise((resolve, reject) => {
  middleware(req, {}, (error) => error ? reject(error) : resolve(req));
});

test("4M subscription records require one service and a price/cadence snapshot", async () => {
  const valid = new ProviderSubscription({
    provider_profile: new mongoose.Types.ObjectId(),
    provider_service: new mongoose.Types.ObjectId(),
    patient_profile: new mongoose.Types.ObjectId(),
    service_snapshot: { title: "Pregnancy care", original_price: 1500, discount_percent: 10, discounted_price: 1350, currency: "NGN", billing_cycle: "monthly" },
    status: "pending_payment",
  });
  await assert.doesNotReject(valid.validate());
  assert.equal(valid.auto_renew, false);

  const missingService = new ProviderSubscription({
    provider_profile: new mongoose.Types.ObjectId(),
    patient_profile: new mongoose.Types.ObjectId(),
    service_snapshot: { title: "Pregnancy care", original_price: 1500, discount_percent: 10, discounted_price: 1350, currency: "NGN", billing_cycle: "monthly" },
    status: "pending_payment",
  });
  await assert.rejects(missingService.validate(), (error) => Boolean(error.errors.provider_service));
});

test("4M prevents concurrent pending checkouts and duplicate active subscriptions per patient/service", () => {
  const index = ProviderSubscription.schema.indexes().find(([keys]) =>
    keys.patient_profile === 1 && keys.provider_service === 1
  );
  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, {
    status: { $in: ["pending_payment", "active"] },
    provider_service: { $exists: true },
  });
});

test("4M payment attempts bind the unique Paystack reference and authoritative amount", async () => {
  const attempt = new ProviderPaymentAttempt({
    provider_subscription: new mongoose.Types.ObjectId(),
    provider_service: new mongoose.Types.ObjectId(),
    provider_profile: new mongoose.Types.ObjectId(),
    patient_profile: new mongoose.Types.ObjectId(),
    purpose: "initial",
    reference: "gt4m-reference-001",
    amount_kobo: 135000,
    billing_email: "patient@example.com",
  });
  await assert.doesNotReject(attempt.validate());
  assert.equal(attempt.status, "initializing");
});

test("billing cadence uses calendar months and clamps month-end dates", () => {
  assert.equal(addBillingCycle(new Date("2026-01-31T10:00:00.000Z"), "monthly").toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(addBillingCycle(new Date("2026-10-14T00:00:00.000Z"), "quarterly").toISOString(), "2027-01-14T00:00:00.000Z");
  assert.equal(addBillingCycle(new Date("2024-02-29T00:00:00.000Z"), "yearly").toISOString(), "2025-02-28T00:00:00.000Z");
});

test("renewal uses one initial attempt then two retries on days 3 and 6 of a 7-day grace period", () => {
  const end = new Date("2026-11-01T00:00:00.000Z");
  assert.equal(getProviderRenewalRetryAt(end, 1).toISOString(), "2026-11-04T00:00:00.000Z");
  assert.equal(getProviderRenewalRetryAt(end, 2).toISOString(), "2026-11-07T00:00:00.000Z");
  assert.equal(getProviderRenewalRetryAt(end, 3), null);
});

test("purchase validator accepts only the service id, consent, and an idempotency key", async () => {
  const req = {
    body: { provider_service_id: new mongoose.Types.ObjectId().toString(), auto_renew: true },
    get: (header) => header === "Idempotency-Key" ? "test-key-123456" : undefined,
  };
  await runMiddleware(validateStartProviderSubscription, req);
  assert.equal(req.autoRenew, true);
  assert.equal(req.idempotencyKey, "test-key-123456");

  await assert.rejects(runMiddleware(validateStartProviderSubscription, {
    ...req,
    body: { provider_service_id: req.body.provider_service_id, amount: 1 },
  }), /Unknown provider subscription field/);
  await assert.rejects(runMiddleware(validateAutoRenew, { body: { enabled: "true" } }), /enabled must be a boolean/);
});

test("Paystack webhook signature validation checks the raw payload bytes", () => {
  const oldSecret = env.paystackSecretKey;
  env.paystackSecretKey = "test-paystack-secret";
  try {
    const raw = Buffer.from('{"event":"charge.success"}');
    const signature = createHmac("sha512", env.paystackSecretKey).update(raw).digest("hex");
    assert.equal(verifyPaystackWebhookSignature(raw, signature), true);
    assert.equal(verifyPaystackWebhookSignature(raw, `${signature.slice(0, -2)}00`), false);
    assert.equal(verifyPaystackWebhookSignature(Buffer.from("{}"), signature), false);
  } finally {
    env.paystackSecretKey = oldSecret;
  }
});

test("reusable Paystack authorization tokens are encrypted and authenticated at rest", () => {
  const oldKey = env.paymentTokenEncryptionKey;
  env.paymentTokenEncryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  try {
    const protectedToken = encryptPaymentToken("AUTH_reusable_token");
    assert.notEqual(protectedToken.ciphertext, "AUTH_reusable_token");
    assert.equal(decryptPaymentToken(protectedToken), "AUTH_reusable_token");
    assert.throws(() => decryptPaymentToken({ ...protectedToken, tag: Buffer.alloc(16).toString("base64") }));
  } finally {
    env.paymentTokenEncryptionKey = oldKey;
  }
});
