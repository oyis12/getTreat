import mongoose from "mongoose";

const { Schema } = mongoose;

const assessmentOptionSchema = new Schema(
  {
    value: { type: String, required: true, trim: true, maxlength: 100 },
    label: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const assessmentQuestionSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["boolean", "single_select", "multi_select", "number", "text"],
      required: true,
    },
    required: { type: Boolean, default: true },
    options: { type: [assessmentOptionSchema], default: [] },
    sort_order: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const assessmentDefinitionSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, trim: true, maxlength: 200, default: null },
    description: { type: String, trim: true, maxlength: 1000, default: null },
    questions: { type: [assessmentQuestionSchema], default: [] },
  },
  { _id: false }
);

const healthConditionSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Health condition name is required"],
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: [true, "Health condition slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    category: {
      type: String,
      enum: ["pregnancy_health"],
      default: "pregnancy_health",
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
    sort_order: { type: Number, default: 0, min: 0 },
    assessment: {
      type: assessmentDefinitionSchema,
      default: () => ({}),
    },
    recommendation_keys: {
      type: [String],
      default: [],
      validate: {
        validator: (values) => new Set(values).size === values.length,
        message: "Recommendation keys must be unique",
      },
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
    versionKey: false,
  }
);

healthConditionSchema.index({ category: 1, active: 1, sort_order: 1 });

const HealthCondition = mongoose.model("HealthCondition", healthConditionSchema);

export default HealthCondition;
