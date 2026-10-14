import mongoose from "mongoose";

const { Schema } = mongoose;
const windowSchema = new Schema({
  start: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  end: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
}, { _id: false });
const weeklyDaySchema = new Schema({
  weekday: { type: Number, min: 0, max: 6, required: true },
  windows: { type: [windowSchema], default: [] },
}, { _id: false });
const exceptionSchema = new Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  unavailable: { type: Boolean, default: false },
  windows: { type: [windowSchema], default: [] },
}, { _id: false });
const providerAvailabilitySchema = new Schema({
  provider_profile: { type: Schema.Types.ObjectId, ref: "ProviderProfile", required: true, unique: true },
  timezone: { type: String, required: true, default: "Africa/Lagos" },
  duration_minutes: { type: Number, enum: [15, 30, 60, 120], required: true, default: 30 },
  fee_amount: { type: Number, min: 0.01, required: true },
  currency: { type: String, enum: ["NGN"], default: "NGN", required: true },
  weekly_schedule: { type: [weeklyDaySchema], default: [] },
  exceptions: { type: [exceptionSchema], default: [] },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

export default mongoose.model("ProviderAvailability", providerAvailabilitySchema);
