import mongoose from "mongoose";

const { Schema } = mongoose;

const providerPayoutMethodSchema = new Schema({
  provider_profile: { type: Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
  recipient_code: { type: String, required: true, index: true, select: false },
  bank_code: { type: String, required: true, maxlength: 20 },
  bank_name: { type: String, required: true, maxlength: 120 },
  account_name: { type: String, required: true, maxlength: 160 },
  account_last4: { type: String, required: true, match: /^\d{4}$/ },
  is_default: { type: Boolean, default: false, required: true },
  active: { type: Boolean, default: true, required: true },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

providerPayoutMethodSchema.index({ provider_profile: 1, active: 1, is_default: 1 });
providerPayoutMethodSchema.index({ provider_profile: 1, is_default: 1 }, { unique: true, partialFilterExpression: { active: true, is_default: true } });

export default mongoose.model("ProviderPayoutMethod", providerPayoutMethodSchema);
