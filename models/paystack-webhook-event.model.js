import mongoose from "mongoose";

const { Schema } = mongoose;

const paystackWebhookEventSchema = new Schema({
  event_key: { type: String, required: true, unique: true },
  event_type: { type: String, required: true, index: true },
  reference: { type: String, default: null, index: true },
  status: { type: String, enum: ["pending", "processing", "processed", "ignored", "failed"], default: "pending", required: true, index: true },
  received_at: { type: Date, default: Date.now, required: true },
  processed_at: { type: Date, default: null },
  available_at: { type: Date, default: Date.now, index: true },
  lock_expires_at: { type: Date, default: null },
  gateway_transaction_id: { type: String, default: null, index: true },
  attempts: { type: Number, default: 0, min: 0 },
  last_error: { type: String, maxlength: 300, default: null },
}, { versionKey: false });

paystackWebhookEventSchema.index({ status: 1, received_at: 1 });

const PaystackWebhookEvent = mongoose.model("PaystackWebhookEvent", paystackWebhookEventSchema);
export default PaystackWebhookEvent;
