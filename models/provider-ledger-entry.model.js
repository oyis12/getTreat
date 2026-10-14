import mongoose from "mongoose";

const { Schema } = mongoose;

const providerLedgerEntrySchema = new Schema({
  provider_profile: { type: Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
  account: { type: String, enum: ["provider", "platform"], required: true, index: true },
  entry_type: { type: String, enum: ["provider_earning", "platform_commission", "payment_reversal", "payout_reserve", "payout_release"], required: true },
  amount_kobo: { type: Number, required: true, validate: Number.isSafeInteger },
  currency: { type: String, enum: ["NGN"], default: "NGN", required: true },
  source_type: { type: String, enum: ["provider_payment", "appointment_payment", "payout", "refund", "reversal"], required: true, index: true },
  source_id: { type: Schema.Types.ObjectId, required: true },
  source_key: { type: String, required: true, unique: true },
  commission_rate_percent: { type: Number, min: 0, max: 100, default: null },
  description: { type: String, maxlength: 240, default: null },
  actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: { createdAt: "createdAt", updatedAt: false }, versionKey: false });

providerLedgerEntrySchema.index({ provider_profile: 1, createdAt: -1 });
providerLedgerEntrySchema.index({ source_type: 1, source_id: 1 });

export default mongoose.model("ProviderLedgerEntry", providerLedgerEntrySchema);
