import mongoose from "mongoose";

const { Schema } = mongoose;

const providerBalanceSchema = new Schema({
  provider_profile: { type: Schema.Types.ObjectId, ref: "ProviderProfile", required: true, unique: true },
  available_kobo: { type: Number, required: true, default: 0 },
  reserved_kobo: { type: Number, required: true, default: 0, min: 0 },
  currency: { type: String, enum: ["NGN"], default: "NGN", required: true },
  modified_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: false, updatedAt: "modified_at" }, versionKey: false });

export default mongoose.model("ProviderBalance", providerBalanceSchema);
