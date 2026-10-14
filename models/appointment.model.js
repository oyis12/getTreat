import mongoose from "mongoose";

const { Schema } = mongoose;
const appointmentSchema = new Schema({
  patient_profile: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
  provider_profile: { type: Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
  provider_subscription: { type: Schema.Types.ObjectId, ref: "ProviderSubscription", required: true },
  appointment_type: { type: Schema.Types.ObjectId, ref: "AppointmentType", required: true },
  appointment_type_snapshot: { name: { type: String, required: true } },
  starts_at: { type: Date, required: true },
  ends_at: { type: Date, required: true },
  timezone: { type: String, required: true },
  mode: { type: String, enum: ["digital"], default: "digital", required: true },
  digital_option: { type: String, enum: ["video_call", "audio_call", "message"], required: true },
  reason: { type: String, trim: true, maxlength: 1000, default: null },
  fee_amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ["NGN"], default: "NGN", required: true },
  status: { type: String, enum: ["pending_payment", "pending", "accepted", "declined", "cancelled", "reschedule_pending", "completed", "missed", "refunded"], default: "pending_payment", required: true, index: true },
  payment_attempt: { type: Schema.Types.ObjectId, ref: "AppointmentPaymentAttempt", default: null },
  rescheduled_from: { type: Schema.Types.ObjectId, ref: "Appointment", default: null },
  decision_reason: { type: String, trim: true, maxlength: 300, default: null },
  decided_at: { type: Date, default: null },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

appointmentSchema.index({ provider_profile: 1, starts_at: 1, status: 1 });
appointmentSchema.index({ patient_profile: 1, starts_at: -1 });
appointmentSchema.index({ provider_profile: 1, starts_at: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["pending", "accepted", "pending_payment"] } } });

export default mongoose.model("Appointment", appointmentSchema);
