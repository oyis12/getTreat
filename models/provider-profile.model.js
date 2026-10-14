import mongoose from "mongoose";

const { Schema } = mongoose;

export const providerProfessionalFields = [
  "gynecology",
  "physiotherapist",
  "food_nutrition",
  "others",
];

export const providerProfessionalFieldLabels = {
  gynecology: "Gynecology",
  physiotherapist: "Physiotherapist",
  food_nutrition: "Food and Nutrition",
  others: "Others",
};

const approvalHistorySchema = new Schema(
  {
    approval_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
    },
    action_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changed_at: { type: Date, default: Date.now, required: true },
  },
  { _id: false }
);

const credentialSchema = new Schema({
  kind: { type: String, enum: ["higher_institution_certificate", "nysc_certificate"], required: true },
  public_id: { type: String, required: true },
  resource_type: { type: String, enum: ["image", "raw", "video"], required: true },
  format: { type: String, required: true },
  uploaded_at: { type: Date, default: Date.now, required: true },
}, { _id: false });

const providerProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    professional_field: {
      type: String,
      enum: providerProfessionalFields,
      required: true,
    },
    professional_field_other: { type: String, trim: true, maxlength: 120, default: null },
    years_experience: { type: Number, min: 0, max: 80, default: null },
    bio: { type: String, trim: true, maxlength: 300, default: null },
    country: { type: String, trim: true, maxlength: 100, default: null },
    state: { type: String, trim: true, maxlength: 100, default: null },
    address: { type: String, trim: true, maxlength: 250, default: null },
    profile_image: { type: String, trim: true, default: null },
    profile_image_public_id: { type: String, trim: true, default: null },
    consents: {
      credentials_valid: { type: Boolean, default: false },
      regulations_agreed: { type: Boolean, default: false },
      professional_data_consent: { type: Boolean, default: false },
      accepted_at: { type: Date, default: null },
    },
    credentials: { type: [credentialSchema], default: [] },
    approval_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
      index: true,
    },
    submitted_at: { type: Date, default: Date.now, required: true },
    approval_history: { type: [approvalHistorySchema], default: [] },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
    versionKey: false,
  }
);

providerProfileSchema.index({ approval_status: 1, submitted_at: -1 });

const ProviderProfile = mongoose.model("ProviderProfile", providerProfileSchema);

export default ProviderProfile;
