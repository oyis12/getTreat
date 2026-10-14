import mongoose from "mongoose";

const { Schema } = mongoose;

const serviceSnapshotSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  original_price: { type: Number, required: true, min: 0 },
  discount_percent: { type: Number, required: true, min: 0, max: 100 },
  discounted_price: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, enum: ["NGN"] },
  billing_cycle: { type: String, required: true, enum: ["monthly", "quarterly", "yearly"] },
}, { _id: false });

const providerSubscriptionSchema = new Schema(
  {
    provider_profile: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true,
    },
    provider_service: {
      type: Schema.Types.ObjectId,
      ref: "ProviderService",
      required: true,
      index: true,
    },
    patient_profile: {
      type: Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending_payment", "active", "expired", "revoked", "payment_failed"],
      required: true,
      index: true,
    },
    service_snapshot: { type: serviceSnapshotSchema, required: true },
    starts_at: { type: Date, default: null },
    ends_at: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return value == null || !this.starts_at || value > this.starts_at;
        },
        message: "ends_at must be after starts_at",
      },
    },
    auto_renew: { type: Boolean, default: false, required: true },
    auto_renew_consent_at: { type: Date, default: null },
    auto_renew_disabled_at: { type: Date, default: null },
    payment_authorization: { type: Schema.Types.ObjectId, ref: "PaymentAuthorization", default: null },
    renewal_attempts: { type: Number, default: 0, min: 0, max: 3 },
    renewal_grace_ends_at: { type: Date, default: null },
    next_renewal_attempt_at: { type: Date, default: null },
    renewal_lock_until: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
    versionKey: false,
  }
);

providerSubscriptionSchema.index({
  provider_profile: 1,
  patient_profile: 1,
  status: 1,
  starts_at: -1,
  ends_at: 1,
});
providerSubscriptionSchema.index(
  { patient_profile: 1, provider_service: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending_payment", "active"] },
      provider_service: { $exists: true },
    },
  }
);

const ProviderSubscription = mongoose.model(
  "ProviderSubscription",
  providerSubscriptionSchema
);

export default ProviderSubscription;
