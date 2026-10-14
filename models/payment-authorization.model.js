import mongoose from "mongoose";

const { Schema } = mongoose;

const paymentAuthorizationSchema = new Schema({
  patient_profile: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
  billing_email: { type: String, required: true, lowercase: true, trim: true },
  paystack_customer_code: { type: String, default: null },
  authorization_code_encrypted: { type: String, required: true, select: false },
  authorization_iv: { type: String, required: true, select: false },
  authorization_tag: { type: String, required: true, select: false },
  encryption_key_version: { type: Number, default: 1, required: true },
  signature_hash: { type: String, required: true, select: false },
  reusable: { type: Boolean, default: true, required: true },
  active: { type: Boolean, default: true, required: true, index: true },
  last_four: { type: String, default: null },
  channel: { type: String, default: null },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

paymentAuthorizationSchema.index({ patient_profile: 1, signature_hash: 1 }, { unique: true });

const PaymentAuthorization = mongoose.model("PaymentAuthorization", paymentAuthorizationSchema);
export default PaymentAuthorization;
