import mongoose from "mongoose";

const { Schema } = mongoose;

const pregnancyHealthConditionSchema = new Schema(
  {
    condition: {
      type: Schema.Types.ObjectId,
      ref: "HealthCondition",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "reported",
        "at_risk",
        "suspected",
        "diagnosed",
        "monitored",
        "resolved",
      ],
      default: "reported",
    },
    source: {
      type: String,
      enum: ["patient", "provider", "assessment", "admin"],
      default: "patient",
    },
    identified_at: { type: Date, default: Date.now },
    notes: { type: String, trim: true, maxlength: 1000, default: null },
  },
  { _id: true, versionKey: false }
);

const healthAssessmentAnswerSchema = new Schema(
  {
    question_key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    value: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const healthAssessmentSchema = new Schema(
  {
    condition: {
      type: Schema.Types.ObjectId,
      ref: "HealthCondition",
      required: true,
    },
    condition_slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    condition_name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    result_status: {
      type: String,
      enum: ["pending", "at_risk", "low_risk", "normal", "needs_review"],
      default: "pending",
    },
    score: { type: Number, min: 0, default: null },
    answers: { type: [healthAssessmentAnswerSchema], default: [] },
    started_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
  },
  { _id: true, versionKey: false }
);

const pregnancySchema = new Schema(
  {
    status: {
      type: String,
      enum: {
        values: ["active", "completed", "ended"],
        message: "Invalid pregnancy status",
      },
      default: "active",
      index: true,
    },
    is_current: { type: Boolean, default: true, index: true },
    conception_method: {
      type: String,
      enum: {
        values: ["natural_conception", "assisted_reproduction"],
        message: "Invalid conception method",
      },
      default: null,
    },
    last_menstral_date: { type: Date, default: null },
    expected_delivery_date: { type: Date, default: null },
    current_trimester: { type: Number, min: 0, max: 3, default: 0 },
    weeks_gone: { type: Number, min: 0, max: 40, default: 0 },
    weeks_left: { type: Number, min: 0, max: 40, default: 0 },
    has_fibroid: { type: Boolean, default: false },
    health_conditions: { type: [pregnancyHealthConditionSchema], default: [] },
    health_assessments: { type: [healthAssessmentSchema], default: [] },
  },
  {
    _id: true,
    timestamps: { createdAt: "createdAt", updatedAt: "modifiedAt" },
    versionKey: false,
  }
);

export { pregnancyHealthConditionSchema, healthAssessmentSchema };
export default pregnancySchema;
