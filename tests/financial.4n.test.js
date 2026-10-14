import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import System from "../models/system.model.js";
import ProviderPaymentAttempt from "../models/provider-payment-attempt.model.js";
import ProviderLedgerEntry from "../models/provider-ledger-entry.model.js";
import ProviderPayout from "../models/provider-payout.model.js";
import ProviderPayoutMethod from "../models/provider-payout-method.model.js";
import { calculateProviderPaymentSplit } from "../services/financial-ledger.service.js";
import { env } from "../config/env.js";
import {
  validatePlatformFeeUpdate,
  validatePayoutMethodBody,
  validatePayoutMethodResolution,
  validatePayoutRequest,
  validatePayoutFinalize,
} from "../validators/financial.validator.js";
import {
  createPaystackTransferRecipient,
  initiatePaystackTransfer,
  resolvePaystackBankAccount,
} from "../services/paystack.service.js";

const runMiddleware = (middleware, req) => new Promise((resolve, reject) => {
  middleware(req, {}, (error) => error ? reject(error) : resolve(req));
});

test("system commission defaults to 15 percent and validates bounded percentage values", async () => {
  const system = new System({ key: "global" });
  assert.equal(system.platform_fee_percent, 15);
  system.platform_fee_percent = 100.01;
  await assert.rejects(system.validate(), (error) => Boolean(error.errors.platform_fee_percent));
});

test("commission split rounds fee in kobo and assigns the remainder to provider", () => {
  assert.deepEqual(calculateProviderPaymentSplit(150000, 15), { platformFeeKobo: 22500, providerNetKobo: 127500 });
  assert.deepEqual(calculateProviderPaymentSplit(101, 15), { platformFeeKobo: 15, providerNetKobo: 86 });
  assert.deepEqual(calculateProviderPaymentSplit(1000, 0), { platformFeeKobo: 0, providerNetKobo: 1000 });
  assert.deepEqual(calculateProviderPaymentSplit(1000, 100), { platformFeeKobo: 1000, providerNetKobo: 0 });
  assert.throws(() => calculateProviderPaymentSplit(0, 15), /positive safe integer/);
  assert.throws(() => calculateProviderPaymentSplit(1000, 101), /between 0 and 100/);
});

test("payment attempts snapshot commission and the ledger is idempotency-keyed", () => {
  const attempt = new ProviderPaymentAttempt({
    provider_subscription: new mongoose.Types.ObjectId(), provider_service: new mongoose.Types.ObjectId(),
    provider_profile: new mongoose.Types.ObjectId(), patient_profile: new mongoose.Types.ObjectId(),
    purpose: "initial", reference: "gt4m-financial-test", amount_kobo: 150000,
    commission_rate_percent: 15, platform_fee_kobo: 22500, provider_net_kobo: 127500,
    commission_snapshotted_at: new Date(), billing_email: "patient@example.com",
  });
  assert.equal(attempt.platform_fee_kobo + attempt.provider_net_kobo, attempt.amount_kobo);
  assert.ok(attempt.commission_snapshotted_at);
  const sourceKeyIndex = ProviderLedgerEntry.schema.indexes().find(([keys]) => keys.source_key === 1);
  assert.equal(sourceKeyIndex?.[1]?.unique, true);
});

test("payout models retain recipient codes privately and enforce provider-scoped idempotency", () => {
  assert.equal(ProviderPayoutMethod.schema.path("recipient_code").options.select, false);
  const recipientCodeIndex = ProviderPayoutMethod.schema.indexes().find(([keys]) => keys.recipient_code === 1);
  assert.equal(recipientCodeIndex?.[1]?.unique, true);
  assert.equal(ProviderPayoutMethod.schema.path("account_number"), undefined);
  const payout = new ProviderPayout({
    provider_profile: new mongoose.Types.ObjectId(), payout_method: new mongoose.Types.ObjectId(),
    amount_kobo: 2500000, idempotency_key: "payout-test-key-1",
  });
  assert.equal(payout.status, "requested");
  assert.equal(payout.amount_kobo, 2500000);
  assert.ok(ProviderPayout.schema.indexes().some(([keys, options]) => keys.provider_profile === 1 && keys.idempotency_key === 1 && options.unique));
});

test("financial validators reject client-supplied money and malformed payout requests", async () => {
  await runMiddleware(validatePlatformFeeUpdate, { body: { platform_fee_percent: 15.25 } });
  await assert.rejects(runMiddleware(validatePlatformFeeUpdate, { body: { platform_fee_percent: 101 } }), /0 to 100/);
  await assert.rejects(runMiddleware(validatePlatformFeeUpdate, { body: { platform_fee_percent: 15, owner: true } }), /Unknown platform financial settings/);

  const methodReq = { body: { bank_code: "058", account_number: "0001234567", confirmed_account_name: "Jane Doe" } };
  await runMiddleware(validatePayoutMethodBody, methodReq);
  await assert.rejects(runMiddleware(validatePayoutMethodResolution, { body: { bank_code: "058", account_number: "bad" } }), /10 digits/);

  const request = { body: { amount: 25000, payout_method_id: new mongoose.Types.ObjectId().toString() }, get: (name) => name === "Idempotency-Key" ? "payout-key-123" : undefined };
  await runMiddleware(validatePayoutRequest, request);
  assert.equal(request.amountKobo, 2500000);
  assert.equal(request.idempotencyKey, "payout-key-123");
  await assert.rejects(runMiddleware(validatePayoutRequest, { ...request, body: { amount: 25000, fee: 5 } }), /Unknown payout request/);
  await assert.rejects(runMiddleware(validatePayoutFinalize, { body: { otp: "12" } }), /4 to 8 digits/);
});

test("Paystack payout helpers send only NUBAN recipient data and integer kobo transfer values", async (t) => {
  const previousSecret = env.paystackSecretKey;
  env.paystackSecretKey = "sk_test_unit_only";
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: String(url), options, body: options.body ? JSON.parse(options.body) : null });
    const data = String(url).includes("transferrecipient")
      ? { recipient_code: "RCP_test", details: { bank_name: "Test Bank" } }
      : String(url).includes("bank/resolve")
        ? { account_name: "Jane Doe", account_number: "0001234567" }
        : { reference: "gtpo-reference-1", amount: 2500000, status: "pending" };
    return { ok: true, status: 200, json: async () => ({ status: true, data }) };
  });
  try {
    await resolvePaystackBankAccount({ accountNumber: "0001234567", bankCode: "058" });
    await createPaystackTransferRecipient({ name: "Jane Doe", accountNumber: "0001234567", bankCode: "058", email: "provider@example.com" });
    await initiatePaystackTransfer({ amountKobo: 2500000, reference: "gtpo-reference-1", recipientCode: "RCP_test", reason: "Test payout" });
    assert.match(requests[0].url, /bank\/resolve\?account_number=0001234567&bank_code=058/);
    assert.equal(requests[1].body.type, "nuban");
    assert.equal(requests[1].body.currency, "NGN");
    assert.equal(requests[2].body.amount, 2500000);
    assert.equal(requests[2].body.source, "balance");
    assert.equal(requests[2].body.recipient, "RCP_test");
  } finally { env.paystackSecretKey = previousSecret; }
});
