import mongoose from "mongoose";

const { Schema } = mongoose;
const appointmentPaymentAttemptSchema = new Schema({
  appointment: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
  provider_profile: { type: Schema.Types.ObjectId, ref: "ProviderProfile", required: true, index: true },
  patient_profile: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
  gateway: { type: String, enum: ["paystack"], default: "paystack", required: true },
  status: { type: String, enum: ["initializing", "pending", "success", "failed", "refund_pending", "refund_failed", "refunded", "reversed"], default: "initializing", required: true, index: true },
  reference: { type: String, required: true, unique: true },
  idempotency_key: { type: String, required: true },
  amount_kobo: { type: Number, required: true, min: 1 },
  commission_rate_percent: { type: Number, required: true, min: 0, max: 100 },
  platform_fee_kobo: { type: Number, required: true, min: 0 },
  provider_net_kobo: { type: Number, required: true, min: 0 },
  commission_snapshotted_at: { type: Date, required: true },
  currency: { type: String, enum: ["NGN"], default: "NGN", required: true },
  billing_email: { type: String, required: true, lowercase: true, trim: true },
  authorization_url: { type: String, default: null },
  access_code: { type: String, default: null },
  gateway_transaction_id: { type: String, default: null },
  verified_at: { type: Date, default: null },
  refund_reference: { type: String, default: null },
  refund_reason: { type: String, maxlength: 300, default: null },
  failure_reason: { type: String, maxlength: 300, default: null },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

appointmentPaymentAttemptSchema.index({ patient_profile: 1, idempotency_key: 1 }, { unique: true });
export default mongoose.model("AppointmentPaymentAttempt", appointmentPaymentAttemptSchema);
