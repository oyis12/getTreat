import mongoose from "mongoose";

const { Schema } = mongoose;

const providerInstructionSchema = new Schema(
  {
    provider_profile: {
      type: Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true,
      index: true,
    },
    patient_profile: {
      type: Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
      index: true,
    },
    provider_name: { type: String, required: true, trim: true, maxlength: 120 },
    provider_profession: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    instruction: { type: String, required: true, trim: true, maxlength: 10000 },
    prescription: { type: String, trim: true, maxlength: 10000, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
    versionKey: false,
  }
);

providerInstructionSchema.index({ patient_profile: 1, createdAt: -1 });
providerInstructionSchema.index({ provider_profile: 1, patient_profile: 1, createdAt: -1 });

const ProviderInstruction = mongoose.model(
  "ProviderInstruction",
  providerInstructionSchema
);

export default ProviderInstruction;
