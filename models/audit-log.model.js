import mongoose from "mongoose";

const { Schema } = mongoose;

const auditLogSchema = new Schema({
  event_key: { type: String, unique: true, sparse: true },
  actor: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  actor_role: { type: String, enum: ["patient", "provider", "admin", "super_admin", "system"], required: true },
  action: { type: String, required: true, maxlength: 100, index: true },
  resource_type: { type: String, required: true, maxlength: 80, index: true },
  resource_id: { type: Schema.Types.ObjectId, default: null, index: true },
  prior_state: { type: String, maxlength: 60, default: null },
  new_state: { type: String, maxlength: 60, default: null },
  correlation_id: { type: String, maxlength: 120, default: null, index: true },
  metadata: { type: Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: { createdAt: "createdAt", updatedAt: false }, versionKey: false });

auditLogSchema.index({ resource_type: 1, resource_id: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
