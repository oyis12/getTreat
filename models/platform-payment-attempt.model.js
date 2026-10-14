import mongoose from "mongoose";

const { Schema } = mongoose;
const platformPaymentAttemptSchema = new Schema({
  platform_subscription: { type: Schema.Types.ObjectId, ref: "PlatformSubscription", required: true, index: true },
  patient_profile: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
  gateway: { type: String, enum: ["paystack"], default: "paystack", required: true },
  purpose: { type: String, enum: ["initial", "renewal"], required: true },
  status: { type: String, enum: ["initializing", "pending", "success", "failed", "reversed", "refunded"], default: "initializing", required: true, index: true },
  reference: { type: String, required: true, unique: true, index: true },
  idempotency_key: { type: String, default: null },
  requested_auto_renew: { type: Boolean, default: false },
  amount_kobo: { type: Number, required: true, min: 1 },
  currency: { type: String, enum: ["NGN"], default: "NGN", required: true },
  billing_email: { type: String, required: true, lowercase: true, trim: true },
  authorization_url: { type: String, default: null },
  access_code: { type: String, default: null },
  gateway_transaction_id: { type: String, default: null },
  attempt_number: { type: Number, default: 0, min: 0, max: 3 },
  verified_at: { type: Date, default: null },
  next_reconcile_at: { type: Date, default: null, index: true },
  failure_reason: { type: String, maxlength: 300, default: null },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

platformPaymentAttemptSchema.index({ patient_profile: 1, idempotency_key: 1 }, { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } });
platformPaymentAttemptSchema.index({ platform_subscription: 1, purpose: 1, attempt_number: 1 }, { unique: true });
export default mongoose.model("PlatformPaymentAttempt", platformPaymentAttemptSchema);
