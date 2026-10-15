import mongoose from "mongoose";

const { Schema } = mongoose;
const planSnapshot = new Schema({
  billing_cycle: { type: String, enum: ["monthly", "quarterly", "yearly"], required: true },
  amount: { type: Number, min: 1, required: true },
  currency: { type: String, enum: ["NGN"], default: "NGN", required: true },
}, { _id: false });

const platformSubscriptionSchema = new Schema({
  patient_profile: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true },
  plan_snapshot: { type: planSnapshot, required: true },
  status: { type: String, enum: ["pending_payment", "active", "expired", "revoked", "payment_failed"], required: true, index: true },
  starts_at: { type: Date, default: null },
  ends_at: { type: Date, default: null },
  auto_renew: { type: Boolean, default: false, required: true },
  auto_renew_consent_at: { type: Date, default: null },
  auto_renew_disabled_at: { type: Date, default: null },
  payment_authorization: { type: Schema.Types.ObjectId, ref: "PaymentAuthorization", default: null },
  renewal_attempts: { type: Number, default: 0, min: 0, max: 3 },
  renewal_grace_ends_at: { type: Date, default: null },
  next_renewal_attempt_at: { type: Date, default: null },
  renewal_lock_until: { type: Date, default: null },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

platformSubscriptionSchema.index({ patient_profile: 1, status: 1, ends_at: -1 });
platformSubscriptionSchema.index(
  { patient_profile: 1 },
  {
    name: "uniq_active_platform_subscription_per_patient",
    unique: true,
    partialFilterExpression: { status: { $in: ["pending_payment", "active"] } },
  }
);

export default mongoose.model("PlatformSubscription", platformSubscriptionSchema);
