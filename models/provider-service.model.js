import mongoose from "mongoose";

const providerServiceSchema = new mongoose.Schema({
  provider_profile: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  original_price: { type: Number, required: true, min: 1 },
  discount_percent: { type: Number, default: 0, min: 0, max: 100 },
  currency: { type: String, default: "NGN", uppercase: true, trim: true, enum: ["NGN"] },
  billing_cycle: { type: String, required: true, enum: ["monthly", "quarterly", "yearly"] },
  active: { type: Boolean, default: true, index: true },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
  versionKey: false,
});

providerServiceSchema.index({ provider_profile: 1, active: 1, createdAt: -1 });
providerServiceSchema.index({ active: 1, billing_cycle: 1, discount_percent: -1 });

const ProviderService = mongoose.model("ProviderService", providerServiceSchema);
export default ProviderService;
