import mongoose from "mongoose";

const { Schema } = mongoose;

const providerSubscriptionSchema = new Schema(
  {
    provider_profile: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true,
    },
    patient_profile: {
      type: Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired"],
      required: true,
      index: true,
    },
    starts_at: { type: Date, required: true },
    ends_at: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.starts_at || value > this.starts_at;
        },
        message: "ends_at must be after starts_at",
      },
    },
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

const ProviderSubscription = mongoose.model(
  "ProviderSubscription",
  providerSubscriptionSchema
);

export default ProviderSubscription;
