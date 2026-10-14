import mongoose from "mongoose";

const { Schema } = mongoose;

const transferAttemptSchema = new Schema({
  reference: { type: String, required: true },
  transfer_code: { type: String, default: null },
  gateway_transfer_id: { type: String, default: null },
  status: { type: String, enum: ["initializing", "pending", "processing", "otp_required", "success", "failed", "reversed", "abandoned", "rejected"], required: true },
  failure_reason: { type: String, maxlength: 240, default: null },
  created_at: { type: Date, default: Date.now },
  modified_at: { type: Date, default: Date.now },
}, { _id: false });

const providerPayoutSchema = new Schema({
  provider_profile: { type: Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
  payout_method: { type: Schema.Types.ObjectId, ref: "ProviderPayoutMethod", required: true },
  amount_kobo: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  currency: { type: String, enum: ["NGN"], default: "NGN", required: true },
  status: { type: String, enum: ["requested", "approved", "processing", "otp_required", "paid", "rejected", "failed", "reversed"], default: "requested", required: true, index: true },
  idempotency_key: { type: String, required: true },
  transfer_attempts: { type: [transferAttemptSchema], default: () => [] },
  reviewed_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewed_at: { type: Date, default: null },
  review_reason: { type: String, maxlength: 300, default: null },
  paid_at: { type: Date, default: null },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

providerPayoutSchema.index({ provider_profile: 1, idempotency_key: 1 }, { unique: true });
providerPayoutSchema.index({ "transfer_attempts.reference": 1 }, { unique: true, sparse: true });
providerPayoutSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("ProviderPayout", providerPayoutSchema);
