import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import AppError from "../utils/AppError.js";

const paystackRequest = async (path, { method = "GET", body } = {}) => {
  if (!env.paystackSecretKey) throw new AppError("Paystack payments are not configured", 503);
  let response;
  try {
    response = await fetch(`https://api.paystack.co${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.paystackSecretKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError("Unable to reach Paystack. Retry using the same idempotency key", 502);
  }

  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok || !payload?.status) {
    const message = typeof payload?.message === "string" ? payload.message : "Paystack request failed";
    throw new AppError(message.slice(0, 180), response.status === 404 ? 404 : 502);
  }
  return payload.data;
};

export const initializePaystackCheckout = ({ email, amountKobo, reference, metadata, recurring }) =>
  paystackRequest("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: String(amountKobo),
      currency: "NGN",
      reference,
      metadata,
      ...(recurring ? { channels: ["card"] } : {}),
      ...(env.paystackCallbackUrl ? { callback_url: env.paystackCallbackUrl } : {}),
    },
  });

export const verifyPaystackTransaction = (reference) =>
  paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);

export const getPaystackTransaction = (transactionId) =>
  paystackRequest(`/transaction/${encodeURIComponent(transactionId)}`);

export const refundPaystackTransaction = ({ transactionId, customerNote, merchantNote }) =>
  paystackRequest("/refund", {
    method: "POST",
    body: { transaction: transactionId, currency: "NGN", customer_note: customerNote, merchant_note: merchantNote },
  });

export const listPaystackBanks = ({ country = "nigeria", currency = "NGN" } = {}) => {
  const query = new URLSearchParams({ country, currency, perPage: "100" });
  return paystackRequest(`/bank?${query}`);
};

export const resolvePaystackBankAccount = ({ accountNumber, bankCode }) => {
  const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
  return paystackRequest(`/bank/resolve?${query}`);
};

export const createPaystackTransferRecipient = ({ name, accountNumber, bankCode, email }) =>
  paystackRequest("/transferrecipient", {
    method: "POST",
    body: { type: "nuban", name, account_number: accountNumber, bank_code: bankCode, currency: "NGN", email },
  });

export const initiatePaystackTransfer = ({ amountKobo, reference, recipientCode, reason }) =>
  paystackRequest("/transfer", {
    method: "POST",
    body: { source: "balance", amount: amountKobo, recipient: recipientCode, reference, reason },
  });

export const verifyPaystackTransfer = (reference) =>
  paystackRequest(`/transfer/verify/${encodeURIComponent(reference)}`);

export const finalizePaystackTransfer = ({ transferCode, otp }) =>
  paystackRequest("/transfer/finalize_transfer", {
    method: "POST",
    body: { transfer_code: transferCode, otp },
  });

export const chargePaystackAuthorization = ({ email, authorizationCode, amountKobo, reference, metadata }) =>
  paystackRequest("/transaction/charge_authorization", {
    method: "POST",
    body: {
      email,
      authorization_code: authorizationCode,
      amount: String(amountKobo),
      currency: "NGN",
      reference,
      metadata,
    },
  });

export const verifyPaystackWebhookSignature = (rawBody, signature) => {
  if (!env.paystackSecretKey || !Buffer.isBuffer(rawBody) || typeof signature !== "string") return false;
  const expected = createHmac("sha512", env.paystackSecretKey).update(rawBody).digest("hex");
  const receivedBytes = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
};
