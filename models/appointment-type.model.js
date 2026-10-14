import mongoose from "mongoose";

const appointmentTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
  active: { type: Boolean, default: true, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" }, versionKey: false });

export default mongoose.model("AppointmentType", appointmentTypeSchema);
