import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import AppError from "./AppError.js";

const getKey = () => {
  const encoded = env.paymentTokenEncryptionKey;
  if (!encoded) throw new AppError("Automatic renewal is temporarily unavailable", 503);
  const key = /^[a-f0-9]{64}$/i.test(encoded)
    ? Buffer.from(encoded, "hex")
    : Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new AppError("Payment token encryption is not configured correctly", 503);
  return key;
};

export const assertPaymentTokenEncryptionConfigured = () => getKey();

export const encryptPaymentToken = (token) => {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { ciphertext: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
};

export const decryptPaymentToken = ({ ciphertext, iv, tag }) => {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
};

export const hashPaymentSignature = (signature) => createHash("sha256").update(signature).digest("hex");
